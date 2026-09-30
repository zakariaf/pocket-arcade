// packages/shell/src/app/perf/cold-start.ts
export type ColdStartReport = {
  /** Process start -> the JS entry mark in start-shell.ts (dyld, RN init, bundle load). */
  readonly nativeMs: number | null;
  /** JS entry mark -> Home's first frame with real data. */
  readonly jsMs: number;
  /** Process start -> Home interactive. The number the < 1 s budget applies to. */
  readonly totalMs: number | null;
};

let jsEntryEpochMs: number | null = null;
let isReported = false;

/** Called once at module scope of start-shell.ts, right after its imports. */
export function markJsEntry(nowEpochMs: number = Date.now()): void {
  jsEntryEpochMs ??= nowEpochMs;
}

/** Returns the report once per process; later calls (warm navigation to Home) return null. */
export function markHomeInteractive(
  nowEpochMs: number,
  processStartEpochMs: number | null,
): ColdStartReport | null {
  if (isReported || jsEntryEpochMs === null) return null;
  isReported = true;
  const nativeMs = processStartEpochMs === null ? null : jsEntryEpochMs - processStartEpochMs;
  return {
    nativeMs,
    jsMs: nowEpochMs - jsEntryEpochMs,
    totalMs: processStartEpochMs === null ? null : nowEpochMs - processStartEpochMs,
  };
}
