// packages/tooling/src/e2e/sim-perf-steps.ts — steps 2 and 3 of `npm run e2e:ios` on the phone
// simulator: the cold-start run (Home set up through the debug-setup sub-flow, then 6 launches
// into Home, read back from the test build's perf log) and
// the memory check (the game's smoke flows, then a relaunch, then `footprint` of the app: Maestro
// 2.10 stops the app when a test ends, so the runner starts it again and the saved run resumes).
// Writes reports/e2e/<game-id>/perf.json, reports/perf/sim-perf-log.json and, on the first run or
// with --write-perf-baseline, perf-baselines/cold-start-sim-<game-id>.json.
import { execFileSync } from 'node:child_process';
import { existsSync, globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import {
  baselineFileText,
  baselineMsFrom,
  COLD_LAUNCHES,
  judgeColdStart,
  judgeMemory,
  latestColdStart,
  perfBudgetsFrom,
  physFootprintFrom,
  type ColdStartResult,
  type MemoryResult,
  type PerfBudgets,
} from '@e07/tooling/e2e/sim-perf.ts';
import {
  appDataDir,
  appEnv,
  appPidOn,
  debugSetupArgs,
  launchApp,
  runMaestro,
  terminateApp,
  type AppInfo,
} from '@e07/tooling/e2e/simulator.ts';

export type PerfStepInput = {
  readonly game: string;
  readonly udid: string;
  readonly app: AppInfo;
  /** reports/e2e/<game-id> */
  readonly out: string;
  readonly isWritingBaseline: boolean;
};

type StepError = { readonly error: string };

// Every measured launch opens Home in English, so no launch reloads for a direction change.
const HOME_QUERY =
  'lang=en&theme=light&seed=42&date=2026-09-26&ads=off&firstRun=0&reduceMotion=1&screen=home';
const COLD_START_TIMEOUT_MS = 30_000;
const POLL_MS = 250;

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** The perf_log payload of the test build's save.db ([] before the first entry). */
function readPerfLog(udid: string, app: AppInfo): unknown {
  try {
    const db = join(appDataDir(udid, app), 'Documents', 'SQLite', 'save.db');
    const sql = 'SELECT payload FROM perf_log WHERE id = 1';
    const payload = execFileSync('sqlite3', [db, sql], { encoding: 'utf8' }).trim();
    return payload === '' ? [] : (JSON.parse(payload) as unknown);
  } catch {
    return []; // no save.db or no perf_log table yet
  }
}

const latestAt = (udid: string, app: AppInfo): number =>
  latestColdStart(readPerfLog(udid, app))?.atEpochMs ?? -1;

/** Waits until Home recorded a cold start newer than `afterEpochMs`; returns its totalMs. */
async function waitForColdStart(udid: string, app: AppInfo, afterEpochMs: number): Promise<number> {
  for (let waitedMs = 0; waitedMs < COLD_START_TIMEOUT_MS; waitedMs += POLL_MS) {
    const latest = latestColdStart(readPerfLog(udid, app));
    if (latest !== null && latest.atEpochMs > afterEpochMs) return latest.totalMs;
    await delay(POLL_MS);
  }
  throw new Error(
    `cold start: no new cold-start entry within ${String(COLD_START_TIMEOUT_MS / 1000)} s; is this a test build whose Home calls useColdStartMark(perfLog)?`,
  );
}

/**
 * Puts the app on Home (language chosen, tutorial done, English) through the debug link, from a
 * fresh launch: the setup sub-flow accepts iOS's "Open in <app>?" prompt, which `simctl openurl`
 * would leave up. Home then records this process's cold start.
 */
async function openHome(input: PerfStepInput): Promise<void> {
  const { udid, app } = input;
  terminateApp(udid, app);
  const setupAt = latestAt(udid, app);
  launchApp(udid, app);
  const outDir = join(input.out, 'cold-start-setup');
  const status = runMaestro(
    debugSetupArgs({ udid, app, query: HOME_QUERY, waitFor: 'home.screen', outDir }),
  );
  if (status !== 0) {
    throw new Error(
      `cold start: the debug link to Home failed (maestro exit ${String(status)}), see ${outDir}`,
    );
  }
  await waitForColdStart(udid, app, setupAt);
}

async function measureColdStart(
  input: PerfStepInput,
  budgets: PerfBudgets,
): Promise<ColdStartResult> {
  const { game, udid, app } = input;
  await openHome(input);
  const launchesMs: number[] = [];
  for (let launch = 0; launch < COLD_LAUNCHES; launch += 1) {
    const seenAt = latestAt(udid, app);
    terminateApp(udid, app);
    launchApp(udid, app);
    launchesMs.push(await waitForColdStart(udid, app, seenAt));
  }
  mkdirSync(join('reports', 'perf'), { recursive: true });
  const perfLog = JSON.stringify(readPerfLog(udid, app), null, 2);
  writeFileSync(join('reports', 'perf', 'sim-perf-log.json'), `${perfLog}\n`);
  const baselineFile = join('perf-baselines', `cold-start-sim-${game}.json`);
  const baselineMs = existsSync(baselineFile)
    ? baselineMsFrom(JSON.parse(readFileSync(baselineFile, 'utf8')) as unknown)
    : null;
  const result = judgeColdStart(launchesMs, baselineMs, budgets);
  if (baselineMs !== null && !input.isWritingBaseline) return result;
  // The first run writes the baseline; a slower rewrite needs the owner and a Gate-Change trailer.
  mkdirSync('perf-baselines', { recursive: true });
  writeFileSync(baselineFile, baselineFileText(result.medianMs));
  console.log(`e2e:ios: wrote ${baselineFile}; commit it with a Gate-Change: trailer`);
  return { ...result, isRegression: false };
}

/** What the memory step does on the simulator, in order (a fake in the test). */
export type MemoryOps = {
  /** apps/<game-id>/e2e/flows/smoke/*.yaml, sorted. */
  readonly smokeFlows: () => readonly string[];
  /** `maestro test <flows>`: its exit code. */
  readonly runFlows: (flows: readonly string[], dir: string) => number;
  /** `xcrun simctl launch`: the app starts again and resumes the saved run. */
  readonly relaunch: () => void;
  readonly pid: () => string | null;
  readonly wait: (ms: number) => Promise<void>;
  /** `footprint --pid <pid> -j <file>`: the parsed report. */
  readonly footprint: (pid: string, file: string) => unknown;
};

/** After the relaunch: the app's pid within 15 s, then 10 s to settle before footprint. */
export const RELAUNCH_PID_TIMEOUT_MS = 15_000;
export const RELAUNCH_SETTLE_MS = 10_000;

async function waitForPid(ops: MemoryOps): Promise<string | null> {
  for (let waitedMs = 0; waitedMs <= RELAUNCH_PID_TIMEOUT_MS; waitedMs += POLL_MS) {
    const pid = ops.pid();
    if (pid !== null) return pid;
    await ops.wait(POLL_MS);
  }
  return null;
}

/** The smoke flows, then (Maestro 2.10 stops the app when a test ends) a relaunch, then footprint. */
export async function measureMemory(
  input: Pick<PerfStepInput, 'game' | 'out'>,
  budgets: PerfBudgets,
  ops: MemoryOps,
): Promise<MemoryResult> {
  const flows = ops.smokeFlows();
  if (flows.length === 0) {
    throw new Error(`memory: apps/${input.game}/e2e/flows/smoke/ has no flow to play first`);
  }
  const dir = join(input.out, 'memory');
  mkdirSync(dir, { recursive: true });
  if (ops.runFlows(flows, dir) !== 0)
    throw new Error(`memory: the smoke flow failed before the measurement, see ${dir}`);
  ops.relaunch();
  const pid = await waitForPid(ops);
  if (pid === null) throw new Error('memory: the app did not start again after the smoke flow');
  await ops.wait(RELAUNCH_SETTLE_MS);
  const file = join(dir, 'footprint.json');
  const bytes = physFootprintFrom(ops.footprint(pid, file));
  if (bytes === null) throw new Error(`memory: footprint measured nothing, see ${file}`);
  return judgeMemory(bytes, budgets);
}

/** The memory step's operations on this simulator and app. */
function simulatorMemoryOps({ game, udid, app }: PerfStepInput): MemoryOps {
  return {
    smokeFlows: () => globSync(`apps/${game}/e2e/flows/smoke/*.yaml`).sort(),
    runFlows: (flows, dir) =>
      runMaestro(['test', ...flows, '--udid', udid, '--test-output-dir', dir, ...appEnv(app)]),
    relaunch: () => {
      launchApp(udid, app);
    },
    pid: () => appPidOn(udid, app.name),
    wait: (ms) => delay(ms),
    footprint: (pid, file) => {
      execFileSync('footprint', ['--pid', pid, '-j', file, '-f', 'bytes', '--noCategories'], {
        stdio: 'ignore',
      });
      return JSON.parse(readFileSync(file, 'utf8')) as unknown;
    },
  };
}

/** Steps 2 and 3; returns one line per failure (an empty list: both passed). */
export async function runPerfSteps(input: PerfStepInput): Promise<string[]> {
  const gatesFile = 'quality-gates.json';
  const budgets = perfBudgetsFrom(
    existsSync(gatesFile) ? (JSON.parse(readFileSync(gatesFile, 'utf8')) as unknown) : {},
  );
  const failures: string[] = [];
  let coldStart: ColdStartResult | StepError;
  try {
    coldStart = await measureColdStart(input, budgets);
    if (coldStart.isRegression) {
      failures.push(
        `cold start: median ${String(coldStart.medianMs)} ms is over ${String(coldStart.limitMs)} ms`,
      );
    }
  } catch (error) {
    coldStart = { error: messageOf(error) };
    failures.push(coldStart.error);
  }
  let memory: MemoryResult | StepError;
  try {
    memory = await measureMemory(input, budgets, simulatorMemoryOps(input));
    if (memory.isOver) {
      failures.push(
        `memory: ${String(memory.physFootprintMb)} MB is over ${String(memory.limitMb)} MB`,
      );
    }
  } catch (error) {
    memory = { error: messageOf(error) };
    failures.push(memory.error);
  }
  writeFileSync(
    join(input.out, 'perf.json'),
    `${JSON.stringify({ coldStart, memory }, null, 2)}\n`,
  );
  return failures;
}
