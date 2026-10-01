// packages/shell/src/screens/debug/debug-perf.ts
// S15's Performance section and the E2E feedback evidence (test builds only): the contract between
// the debug kit and the perf layer. performance-budgets implements it behind the test-only entry:
// TEST_ONLY.createDebugPerfActions (app/perf/debug-perf-actions.ts) gives DebugPerfActions, and
// TEST_ONLY.recordAudioFeedback / recordHapticsFeedback (services/audio/recording-feedback.ts) wrap the two
// feedback ports so each cue also appends { kind: 'feedback', label } to the perf log. All three
// take DebugPerfDeps. createDebugParts builds them once over the debug services' perf log, so
// use-debug-model reads services.perf and never imports test-only.ts (that would close an import
// loop through the test-only entry). perfSummaryOf is the section's value, read from the log itself.
import type { PerfEntry, PerfLog } from '@e07/shell/app/perf/perf-log.ts';

export type DebugPerfDeps = {
  /** DebugServices' perf log (TEST_ONLY.createPerfLog over the save database). */
  readonly perfLog: PerfLog;
  /** The wall clock of new entries (the simulated clock's nowMs). */
  readonly nowMs: () => number;
};

export type DebugPerfActions = {
  /** "Record frame times": the switch the board hosts' sampleFrame reads. */
  readonly isRecording: () => boolean;
  /** Off appends the recorded frames entry to the perf log. */
  readonly setRecording: (isOn: boolean) => void;
  /** "Share performance report": the iOS share sheet with the perf log as JSON (nothing is sent). */
  readonly share: () => Promise<void>;
  /** "Run save benchmark": 300 writes into perf-bench.db, then one save-benchmark entry. */
  readonly runSaveBenchmark: () => void;
};

export type DebugPerfSummary = {
  /** Cold starts Home recorded (one per launch into Home). */
  readonly coldStarts: number;
  /** The newest cold start in ms, or null. */
  readonly lastColdStartMs: number | null;
  /** The newest save benchmark's p95 in ms, or null before the first run. */
  readonly saveP95Ms: number | null;
};

const numberOf = (value: PerfEntry['data'][string] | undefined): number | null =>
  typeof value === 'number' ? value : null;

/** The section's numbers from the perf log's entries (oldest first). */
export function perfSummaryOf(entries: readonly PerfEntry[]): DebugPerfSummary {
  const coldStarts = entries.filter((entry) => entry.kind === 'cold-start');
  const benchmark = entries.findLast((entry) => entry.kind === 'save-benchmark');
  return {
    coldStarts: coldStarts.length,
    lastColdStartMs: numberOf(coldStarts.at(-1)?.data['totalMs']),
    saveP95Ms: numberOf(benchmark?.data['p95']),
  };
}

const msText = (ms: number | null): string => (ms === null ? '–' : `${String(ms)} ms`);

/**
 * debug.perf-summary: "cold 2 · 1049 ms · save p95 0.41 ms" (the cold starts, the newest one, the
 * newest save benchmark). A tester's number line like debug.network-attempts, never translated.
 */
export function perfSummaryText(summary: DebugPerfSummary): string {
  const cold = `cold ${String(summary.coldStarts)} · ${msText(summary.lastColdStartMs)}`;
  return `${cold} · save p95 ${msText(summary.saveP95Ms)}`;
}
