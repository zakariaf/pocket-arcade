// packages/tooling/src/e2e/sim-perf-steps.ts — steps 2 and 3 of `npm run e2e:ios` on the phone
// simulator: the cold-start run (6 launches into Home, read back from the test build's perf log) and
// the memory check (the game's smoke flows, then `footprint` of the app). Writes
// reports/e2e/<game-id>/perf.json, reports/perf/sim-perf-log.json and, on the first run or with
// --write-perf-baseline, perf-baselines/cold-start-sim-<game-id>.json.
import { execFileSync } from 'node:child_process';
import { existsSync, globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import {
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
  launchApp,
  openUrl,
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

async function measureColdStart(
  input: PerfStepInput,
  budgets: PerfBudgets,
): Promise<ColdStartResult> {
  const { game, udid, app } = input;
  // Put the app on Home (language chosen, tutorial done) through the debug link, cold.
  terminateApp(udid, app);
  const setupAt = latestAt(udid, app);
  openUrl(udid, `${app.scheme}://debug/setup?${HOME_QUERY}`);
  await waitForColdStart(udid, app, setupAt);
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
  writeFileSync(baselineFile, `${JSON.stringify({ medianMs: Math.round(result.medianMs) })}\n`);
  console.log(`e2e:ios: wrote ${baselineFile}; commit it with a Gate-Change: trailer`);
  return { ...result, isRegression: false };
}

function measureMemory(input: PerfStepInput, budgets: PerfBudgets): MemoryResult {
  const { game, udid, app } = input;
  const flows = globSync(`apps/${game}/e2e/flows/smoke/*.yaml`).sort();
  if (flows.length === 0) {
    throw new Error(`memory: apps/${game}/e2e/flows/smoke/ has no flow to play first`);
  }
  const dir = join(input.out, 'memory');
  mkdirSync(dir, { recursive: true });
  const status = runMaestro([
    'test',
    ...flows,
    '--udid',
    udid,
    '--test-output-dir',
    dir,
    ...appEnv(app),
  ]);
  if (status !== 0)
    throw new Error(`memory: the smoke flow failed before the measurement, see ${dir}`);
  const pid = appPidOn(udid, app.name);
  if (pid === null) throw new Error('memory: the app is not running after the smoke flow');
  const file = join(dir, 'footprint.json');
  execFileSync('vmmap', ['--pid', pid, '-j', file, '-f', 'bytes', '--noCategories'], {
    stdio: 'ignore',
  });
  const bytes = physFootprintFrom(JSON.parse(readFileSync(file, 'utf8')) as unknown);
  if (bytes === null) throw new Error(`memory: footprint measured nothing, see ${file}`);
  return judgeMemory(bytes, budgets);
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
    memory = measureMemory(input, budgets);
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
