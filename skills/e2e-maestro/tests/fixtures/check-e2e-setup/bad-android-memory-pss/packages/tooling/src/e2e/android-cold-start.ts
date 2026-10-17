// packages/tooling/src/e2e/android-cold-start.ts
// The emulator cold start, pure. Each measured launch is `adb -s <serial> shell am start -W -S -n
// <package>/.MainActivity` (coldLaunchArgs): -S stops the app first, -W prints LaunchState and
// TotalTime. The time judged is the same as on the simulator, the perf log's newest cold-start entry
// (process start to Home ready, written by the test build's perf layer, the Kotlin ProcessStartModule
// on Android); am start's TotalTime (to the first frame) is kept beside it, and a launch that was not
// COLD is refused. The baseline is perf-baselines/cold-start-emu-<game-id>.json, apart from the
// simulator's, judged with judgeColdStart (sim-perf.ts) x perf.coldStartEmuRegressionFactor.
import { join } from 'node:path';

import { latestColdStart } from '@e07/tooling/e2e/sim-perf.ts';

export type AmStartResult = {
  readonly status: string | null;
  readonly launchState: string | null;
  readonly totalTimeMs: number | null;
  readonly waitTimeMs: number | null;
};

/** One measured launch: the perf log's cold start, with am start's TotalTime beside it. */
export type EmuLaunch = {
  readonly totalMs: number;
  readonly amTotalTimeMs: number | null;
  readonly launchState: string;
};

const fieldOf = (output: string, name: string): string | null =>
  new RegExp(`^${name}:\\s*(\\S+)\\s*$`, 'm').exec(output)?.[1] ?? null;

const msOf = (output: string, name: string): number | null => {
  const text = fieldOf(output, name);
  return text !== null && /^\d+$/.test(text) ? Number(text) : null;
};

/** Status, LaunchState, TotalTime and WaitTime of an `am start -W` answer (null when absent). */
export function parseAmStart(output: string): AmStartResult {
  return {
    status: fieldOf(output, 'Status'),
    launchState: fieldOf(output, 'LaunchState'),
    totalTimeMs: msOf(output, 'TotalTime'),
    waitTimeMs: msOf(output, 'WaitTime'),
  };
}

/**
 * The launch's result, or the problem as one line: am start did not complete, the launch was not
 * cold, or the perf log has no cold start newer than `afterEpochMs` (the previous launch's entry).
 */
export function emuLaunchOf(
  amStart: AmStartResult,
  perfLog: unknown,
  afterEpochMs: number,
): EmuLaunch | string {
  if (amStart.status !== 'ok') return 'cold start: am start did not report Status: ok';
  if (amStart.launchState !== 'COLD') {
    return `cold start: the launch was ${String(amStart.launchState)}, not COLD (am start -W -S stops the app first)`;
  }
  const latest = latestColdStart(perfLog);
  if (latest === null || latest.atEpochMs <= afterEpochMs) {
    return 'cold start: no cold-start entry newer than the launch in the perf log (a test build whose Home calls useColdStartMark?)';
  }
  return { totalMs: latest.totalMs, amTotalTimeMs: amStart.totalTimeMs, launchState: 'COLD' };
}

/** The committed emulator baseline, never the simulator's: the two machines differ. */
export function emuBaselineFile(game: string): string {
  return join('perf-baselines', `cold-start-emu-${game}.json`);
}

const DEFAULT_FACTOR = 1.2;

const recordOf = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : {};

/** quality-gates.json perf.coldStartEmuRegressionFactor, else the simulator's factor, else 1.2. */
export function emuColdStartFactorFrom(qualityGates: unknown): number {
  const perf = recordOf(recordOf(qualityGates)['perf']);
  const emu = perf['coldStartEmuRegressionFactor'];
  const sim = perf['coldStartSimRegressionFactor'];
  if (typeof emu === 'number') return emu;
  return typeof sim === 'number' ? sim : DEFAULT_FACTOR;
}
