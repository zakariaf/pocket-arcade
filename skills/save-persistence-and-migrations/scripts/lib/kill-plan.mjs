// kill-plan.mjs: the kill test's timing, kept pure so the self-test proves it without a simulator.
// The kills must land while the startup writes run. Those writes start only after the native and
// JS start-up (measured 2026-10-04 on Xcode 26.6 / iOS 26.5, Line Siege Release test build: the
// first WAL write about 1,000 ms after `simctl launch` returned), so a fixed 80 ... 960 ms window
// killed every launch before the app opened save.db. Without --step-ms the kill test calibrates:
// one launch measures the first write, and the rounds spread over KILL_WINDOW_FACTOR times it.

/** The rounds reach this multiple of the measured first write, so later rounds see it finish. */
export const KILL_WINDOW_FACTOR = 1.5;
/** The smallest step: the default of the fixed plan, kept for very fast start-ups. */
export const MIN_STEP_MS = 80;
/** How long the calibration launch waits for the first save write before it gives up. */
export const CALIBRATION_TIMEOUT_MS = 20_000;

/**
 * The delay step between kill rounds: the given --step-ms when there is one, else the step that
 * spreads `kills` rounds over KILL_WINDOW_FACTOR x the measured first write (never under 80 ms).
 */
export function killStepMs({ kills, stepMs, firstWriteMs }) {
  if (stepMs !== undefined) return stepMs;
  if (firstWriteMs === null || firstWriteMs === undefined) return MIN_STEP_MS;
  return Math.max(MIN_STEP_MS, Math.ceil((firstWriteMs * KILL_WINDOW_FACTOR) / kills));
}

/**
 * Whether the save's WAL file shows a write made after the launch: a non-empty file modified at
 * or after `launchedAtMs` (an older WAL from an earlier run does not count).
 */
export function isWriteAfterLaunch(walStat, launchedAtMs) {
  return walStat !== null && walStat.size > 0 && walStat.mtimeMs >= launchedAtMs;
}
