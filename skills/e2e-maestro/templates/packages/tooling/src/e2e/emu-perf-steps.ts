// packages/tooling/src/e2e/emu-perf-steps.ts
// device-only: covered by npm run e2e:android on an e07-android-* emulator (cold-start.json, memory.json, feedback.json), then check-e2e-report --platform android
// The cold-start and memory steps of `npm run e2e:android` on the phone emulator.
// Cold start: the debug link to Home through a VIEW intent (deepLinkArgs: no "Open in" alert on
// Android; the app reads it as its launch URL), then 6 launches with `am start -W -S`, each judged
// from the perf log's newest cold start (emuLaunchOf, with am start's TotalTime beside it); the
// median of the last 5 against perf-baselines/cold-start-emu-<game-id>.json (judgeColdStart).
// Memory: the game's smoke flows, feedback.json from the perf log, a relaunch, 10 s to settle, then
// `dumpsys meminfo`: private dirty + swap against the 150 MB budget, like the iOS footprint (total
// PSS beside it as information; lead decision 2026-10-17). Writes cold-start.json,
// memory.json and feedback.json into reports/e2e-android/<game-id>/ and reports/perf/emu-perf-log.json.
import { existsSync, globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { adb } from '@e07/tooling/android/emulator-device.ts';
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
import { adbOn, runMaestroAndroid } from '@e07/tooling/e2e/android-e2e-device.ts';
import { judgeMemory, memoryOf } from '@e07/tooling/e2e/android-memory.ts';
import { pidOf } from '@e07/tooling/e2e/android-socket-sampler.ts';
import { feedbackEvidenceOf, feedbackFileText } from '@e07/tooling/e2e/feedback-evidence.ts';
import { HOME_QUERY, memoryFlowArgs } from '@e07/tooling/e2e/sim-perf-steps.ts';
import {
  baselineFileText,
  COLD_LAUNCHES,
  coldStartBaselinePlan,
  judgeColdStart,
  latestColdStart,
  perfBudgetsFrom,
  type PerfBudgets,
} from '@e07/tooling/e2e/sim-perf.ts';

import type { AndroidRun } from '@e07/tooling/e2e/android-flow-steps.ts';

const WAIT_MS = 30_000;
const POLL_MS = 500;
const SETTLE_MS = 10_000;

const latestAt = (log: unknown): number => latestColdStart(log)?.atEpochMs ?? -1;

/** What a poll accepted, and the perf log it was read from (carried on, never read again). */
type Accepted<T> = { readonly value: T; readonly log: unknown };

/** Polls the perf log until `judge` accepts it (every 500 ms, at most 30 s); the last refusal throws. */
async function pollLog<T>(
  run: AndroidRun,
  judge: (log: unknown) => T | string,
): Promise<Accepted<T>> {
  let last = 'cold start: nothing read yet';
  for (let waitedMs = 0; waitedMs < WAIT_MS; waitedMs += POLL_MS) {
    const log = run.readLog();
    const value = judge(log);
    if (typeof value !== 'string') return { value, log };
    last = value;
    await delay(POLL_MS);
  }
  throw new Error(`${last} (after ${String(WAIT_MS / 1000)} s)`);
}

/** Home through the debug link as the launch URL: every later launch lands on Home in English. */
async function openHome(run: AndroidRun): Promise<unknown> {
  const { phone, app } = run;
  adbOn(phone, forceStopArgs(phone.serial, app.id));
  const before = latestAt(run.readLog());
  const link = `${app.scheme}://debug/setup?${HOME_QUERY}`;
  adbOn(phone, deepLinkArgs(phone.serial, link, app.id));
  const opened = await pollLog(run, (log) => {
    const entry = latestColdStart(log);
    return entry !== null && entry.atEpochMs > before ? entry : 'cold start: Home never opened';
  });
  return opened.log;
}

async function measureColdStart(run: AndroidRun, budgets: PerfBudgets): Promise<unknown> {
  const { game, isWritingBaseline } = run.cli;
  const file = emuBaselineFile(game);
  const committed = existsSync(file) ? readFileSync(file, 'utf8') : null;
  const plan = coldStartBaselinePlan(file, committed, isWritingBaseline);
  if (plan.kind === 'invalid') throw new Error(`cold start: ${plan.message}`);
  let log = await openHome(run);
  const launches: EmuLaunch[] = [];
  for (let launch = 0; launch < COLD_LAUNCHES; launch += 1) {
    const before = latestAt(log);
    const answer = parseAmStart(adbOn(run.phone, coldLaunchArgs(run.phone.serial, run.app.id)));
    const accepted = await pollLog(run, (read) => emuLaunchOf(answer, read, before));
    launches.push(accepted.value);
    log = accepted.log;
  }
  mkdirSync(join('reports', 'perf'), { recursive: true });
  writeFileSync(join('reports', 'perf', 'emu-perf-log.json'), `${JSON.stringify(log, null, 2)}\n`);
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
async function relaunchedPid(run: AndroidRun): Promise<string | null> {
  const { phone, app } = run;
  adb(phone, launchArgs(app.id));
  for (let waitedMs = 0; waitedMs < WAIT_MS; waitedMs += POLL_MS) {
    try {
      const pid = pidOf(adbOn(phone, pidofArgs(phone.serial, app.id)));
      if (pid !== null) return pid;
    } catch {
      // pidof exits 1 while the app is not running yet
    }
    await delay(POLL_MS);
  }
  return null;
}

async function measureMemory(run: AndroidRun, budgets: PerfBudgets): Promise<unknown> {
  const { game } = run.cli;
  const flows = globSync(`apps/${game}/e2e/flows/smoke/*.yaml`).sort();
  if (flows.length === 0) throw new Error(`memory: apps/${game}/e2e/flows/smoke/ has no flow`);
  const dir = join(run.out, 'memory');
  mkdirSync(dir, { recursive: true });
  if ((await runMaestroAndroid(run.maestro, memoryFlowArgs(flows, dir, run.app), run.env)) !== 0) {
    throw new Error(`memory: the smoke flow failed before the measurement, see ${dir}`);
  }
  const feedback = feedbackEvidenceOf(run.readLog(), flows);
  writeFileSync(join(run.out, 'feedback.json'), feedbackFileText(feedback));
  if ((await relaunchedPid(run)) === null)
    throw new Error('memory: the app did not start again after the smoke flow');
  await delay(SETTLE_MS);
  const meminfo = adbOn(run.phone, meminfoArgs(run.phone.serial, run.app.id));
  writeFileSync(join(dir, 'meminfo.txt'), meminfo);
  const reading = memoryOf(meminfo);
  if (reading === null)
    throw new Error(`memory: dumpsys meminfo found no process, see ${dir}/meminfo.txt`);
  return judgeMemory(reading, budgets);
}

const errorOf = (error: unknown): { readonly error: string } => ({
  error: error instanceof Error ? error.message : String(error),
});

/** Cold start, then memory, on the phone: each result (or its error) into its file; a line per failure. */
export async function runEmuPerfSteps(run: AndroidRun): Promise<string[]> {
  const gates = existsSync('quality-gates.json')
    ? (JSON.parse(readFileSync('quality-gates.json', 'utf8')) as unknown)
    : {};
  const shared = perfBudgetsFrom(gates);
  const budgets = { ...shared, coldStartSimRegressionFactor: emuColdStartFactorFrom(gates) };
  const coldStart = await measureColdStart(run, budgets).catch(errorOf);
  const memory = await measureMemory(run, budgets).catch(errorOf);
  writeFileSync(join(run.out, 'cold-start.json'), `${JSON.stringify(coldStart, null, 2)}\n`);
  writeFileSync(join(run.out, 'memory.json'), `${JSON.stringify(memory, null, 2)}\n`);
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
    return `${step}: private dirty + swap ${String(record['footprintMb'])} MB is over ${String(record['limitMb'])} MB (total PSS ${String(record['totalPssMb'])} MB, information only)`;
  return null;
}
