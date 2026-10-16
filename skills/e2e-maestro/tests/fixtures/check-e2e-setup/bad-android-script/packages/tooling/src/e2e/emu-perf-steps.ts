// packages/tooling/src/e2e/emu-perf-steps.ts
// device-only: covered by npm run e2e:android on an e07-android-* emulator (cold-start.json, memory.json, feedback.json), then check-e2e-report --platform android
// The cold-start and memory steps of `npm run e2e:android` on the phone emulator.
// Cold start: the debug link to Home through a VIEW intent (deepLinkArgs: no "Open in" alert on
// Android; the app reads it as its launch URL), then 6 launches with `am start -W -S`, each judged
// from the perf log's newest cold start (emuLaunchOf, with am start's TotalTime beside it); the
// median of the last 5 against perf-baselines/cold-start-emu-<game-id>.json (judgeColdStart).
// Memory: the game's smoke flows, feedback.json from the perf log, a relaunch, 10 s to settle, then
// `dumpsys meminfo` total PSS against the 150 MB budget (lead decision e). Writes cold-start.json,
// memory.json and feedback.json into reports/e2e-android/<game-id>/ and reports/perf/emu-perf-log.json.
import { existsSync, globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { launchArgs } from '@e07/tooling/build/emu-build-plan.ts';
import {
  emuBaselineFile,
  emuColdStartFactorFrom,
  emuLaunchOf,
  parseAmStart,
  type EmuLaunch,
} from '@e07/tooling/e2e/android-cold-start.ts';
import {
  coldLaunchArgs,
  deepLinkArgs,
  forceStopArgs,
  meminfoArgs,
  pidofArgs,
} from '@e07/tooling/e2e/android-device-args.ts';
import {
  adbOn,
  androidAppEnv,
  runMaestroAndroid,
  type AndroidApp,
  type AndroidMaestroDevice,
  type Device,
} from '@e07/tooling/e2e/android-e2e-device.ts';
import { judgePss, totalPssKbOf } from '@e07/tooling/e2e/android-memory.ts';
import { pidOf } from '@e07/tooling/e2e/android-socket-sampler.ts';
import { feedbackEvidenceOf, feedbackFileText } from '@e07/tooling/e2e/feedback-evidence.ts';
import {
  baselineFileText,
  COLD_LAUNCHES,
  coldStartBaselinePlan,
  judgeColdStart,
  latestColdStart,
  perfBudgetsFrom,
  type PerfBudgets,
} from '@e07/tooling/e2e/sim-perf.ts';

export type EmuPerfInput = {
  readonly game: string;
  readonly device: Device;
  readonly maestro: AndroidMaestroDevice;
  readonly app: AndroidApp;
  /** reports/e2e-android/<game-id> */
  readonly out: string;
  readonly isWritingBaseline: boolean;
  /** The perf log of the test build (perfLogReader: save.db pulled with adb root). */
  readonly readLog: () => unknown;
};

const HOME_QUERY =
  'lang=en&theme=light&seed=42&date=2026-09-26&ads=off&firstRun=0&reduceMotion=1&screen=home';
const WAIT_MS = 30_000;
const POLL_MS = 500;
const SETTLE_MS = 10_000;

const latestAt = (input: EmuPerfInput): number => latestColdStart(input.readLog())?.atEpochMs ?? -1;

/** Polls the perf log until `judge` accepts it (every 500 ms, at most 30 s); the last refusal throws. */
async function pollLog<T>(input: EmuPerfInput, judge: (log: unknown) => T | string): Promise<T> {
  let last = 'cold start: nothing read yet';
  for (let waitedMs = 0; waitedMs < WAIT_MS; waitedMs += POLL_MS) {
    const result = judge(input.readLog());
    if (typeof result !== 'string') return result;
    last = result;
    await delay(POLL_MS);
  }
  throw new Error(`${last} (after ${String(WAIT_MS / 1000)} s)`);
}

/** Home through the debug link as the launch URL: every later launch lands on Home in English. */
async function openHome(input: EmuPerfInput): Promise<void> {
  const { device, app } = input;
  adbOn(device, forceStopArgs(device.serial, app.id));
  const before = latestAt(input);
  const link = `${app.scheme}://debug/setup?${HOME_QUERY}`;
  adbOn(device, deepLinkArgs(device.serial, link, app.id));
  await pollLog(input, (log) => {
    const entry = latestColdStart(log);
    return entry !== null && entry.atEpochMs > before ? entry : 'cold start: Home never opened';
  });
}

async function measureColdStart(input: EmuPerfInput, budgets: PerfBudgets): Promise<unknown> {
  const file = emuBaselineFile(input.game);
  const committed = existsSync(file) ? readFileSync(file, 'utf8') : null;
  const plan = coldStartBaselinePlan(file, committed, input.isWritingBaseline);
  if (plan.kind === 'invalid') throw new Error(`cold start: ${plan.message}`);
  await openHome(input);
  const launches: EmuLaunch[] = [];
  for (let launch = 0; launch < COLD_LAUNCHES; launch += 1) {
    const before = latestAt(input);
    const answer = parseAmStart(
      adbOn(input.device, coldLaunchArgs(input.device.serial, input.app.id)),
    );
    launches.push(await pollLog(input, (log) => emuLaunchOf(answer, log, before)));
  }
  mkdirSync(join('reports', 'perf'), { recursive: true });
  writeFileSync(
    join('reports', 'perf', 'emu-perf-log.json'),
    `${JSON.stringify(input.readLog(), null, 2)}\n`,
  );
  const result = judgeColdStart(
    launches.map((launch) => launch.totalMs),
    plan.baselineMs,
    budgets,
  );
  const amTotalTimesMs = launches.map((launch) => launch.amTotalTimeMs);
  if (plan.kind === 'judge') return { ...result, amTotalTimesMs };
  mkdirSync('perf-baselines', { recursive: true });
  writeFileSync(file, baselineFileText(result.medianMs));
  console.log(`e2e:android: wrote ${file}; commit it with a Gate-Change: trailer`);
  return { ...result, isRegression: false, amTotalTimesMs };
}

/** The app's pid after a relaunch (pidof every 500 ms, at most 30 s), or null. */
async function relaunchedPid(input: EmuPerfInput): Promise<string | null> {
  const { device, app } = input;
  adbOn(device, ['-s', device.serial, ...launchArgs(app.id)]);
  for (let waitedMs = 0; waitedMs < WAIT_MS; waitedMs += POLL_MS) {
    try {
      const pid = pidOf(adbOn(device, pidofArgs(device.serial, app.id)));
      if (pid !== null) return pid;
    } catch {
      // pidof exits 1 while the app is not running yet
    }
    await delay(POLL_MS);
  }
  return null;
}

async function measureMemory(input: EmuPerfInput, budgets: PerfBudgets): Promise<unknown> {
  const flows = globSync(`apps/${input.game}/e2e/flows/smoke/*.yaml`).sort();
  if (flows.length === 0)
    throw new Error(`memory: apps/${input.game}/e2e/flows/smoke/ has no flow`);
  const dir = join(input.out, 'memory');
  mkdirSync(dir, { recursive: true });
  const args = ['test', ...flows, '--test-output-dir', dir, '--exclude-tags', 'quarantine'];
  if ((await runMaestroAndroid(input.maestro, [...args, ...androidAppEnv(input.app)])) !== 0) {
    throw new Error(`memory: the smoke flow failed before the measurement, see ${dir}`);
  }
  const feedback = feedbackEvidenceOf(input.readLog(), flows);
  writeFileSync(join(input.out, 'feedback.json'), feedbackFileText(feedback));
  if ((await relaunchedPid(input)) === null)
    throw new Error('memory: the app did not start again after the smoke flow');
  await delay(SETTLE_MS);
  const meminfo = adbOn(input.device, meminfoArgs(input.device.serial, input.app.id));
  writeFileSync(join(dir, 'meminfo.txt'), meminfo);
  const kb = totalPssKbOf(meminfo);
  if (kb === null)
    throw new Error(`memory: dumpsys meminfo found no process, see ${dir}/meminfo.txt`);
  return judgePss(kb, budgets);
}

const errorOf = (error: unknown): { readonly error: string } => ({
  error: error instanceof Error ? error.message : String(error),
});

/** Cold start, then memory: each result (or its error) into its own file; one line per failure. */
export async function runEmuPerfSteps(input: EmuPerfInput): Promise<string[]> {
  const gates = existsSync('quality-gates.json')
    ? (JSON.parse(readFileSync('quality-gates.json', 'utf8')) as unknown)
    : {};
  const shared = perfBudgetsFrom(gates);
  const budgets = { ...shared, coldStartSimRegressionFactor: emuColdStartFactorFrom(gates) };
  const coldStart = await measureColdStart(input, budgets).catch(errorOf);
  const memory = await measureMemory(input, budgets).catch(errorOf);
  writeFileSync(join(input.out, 'cold-start.json'), `${JSON.stringify(coldStart, null, 2)}\n`);
  writeFileSync(join(input.out, 'memory.json'), `${JSON.stringify(memory, null, 2)}\n`);
  return [stepFailure('cold start', coldStart), stepFailure('memory', memory)].filter(
    (line): line is string => line !== null,
  );
}

/** The failure line of a step's result, or null when it passed. */
function stepFailure(step: string, result: unknown): string | null {
  const record = (typeof result === 'object' && result !== null ? result : {}) as Readonly<
    Record<string, unknown>
  >;
  if (typeof record['error'] === 'string') return record['error'];
  if (record['isRegression'] === true)
    return `${step}: median ${String(record['medianMs'])} ms is over ${String(record['limitMs'])} ms`;
  if (record['isOver'] === true)
    return `${step}: total PSS ${String(record['totalPssMb'])} MB is over ${String(record['limitMb'])} MB`;
  return null;
}
