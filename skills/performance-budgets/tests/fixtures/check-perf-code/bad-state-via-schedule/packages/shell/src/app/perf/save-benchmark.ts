// packages/shell/src/app/perf/save-benchmark.ts
// Test builds only (reached through TEST_ONLY). Debug menu > Performance > "Run save benchmark":
// the per-move write of the largest realistic save, 300 times, into a scratch database.
import type { PerfEntry } from './perf-log.ts';
import type { SaveStore, SlotRecord } from '@e07/shell/services/save/save-store.ts';

/** The scratch database the benchmark writes to: never the player's save.db. */
export const BENCHMARK_DB_FILE = 'perf-bench.db';
export const BENCHMARK_WRITES = 300;
const WARMUP_WRITES = 20;

export type SaveBenchmarkInput = {
  /** A SaveStore over BENCHMARK_DB_FILE (the expo-sqlite driver on device). */
  readonly store: SaveStore;
  /** The largest realistic save, encoded: 90 levels, 60 daily results, a 200-move run. */
  readonly record: SlotRecord;
  /** High-resolution clock in ms (performance.now on device). */
  readonly now: () => number;
};
export type SaveBenchmarkResult = {
  readonly p50: number;
  readonly p95: number;
  readonly max: number;
};

function percentile(sortedMs: readonly number[], p: number): number {
  const index = Math.min(sortedMs.length - 1, Math.ceil((p / 100) * sortedMs.length) - 1);
  return sortedMs[index] ?? Number.NaN;
}

/** Pure: p50, p95 and max of the measured write times, rounded to 0.01 ms. */
export function summarizeWriteTimes(samplesMs: readonly number[]): SaveBenchmarkResult {
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const round = (ms: number): number => Math.round(ms * 100) / 100;
  return {
    p50: round(percentile(sorted, 50)),
    p95: round(percentile(sorted, 95)),
    max: round(sorted.at(-1) ?? Number.NaN),
  };
}

/** Writes `current` BENCHMARK_WRITES times after a warm-up and times each write. */
export function runSaveBenchmark({ store, record, now }: SaveBenchmarkInput): SaveBenchmarkResult {
  const samples: number[] = [];
  for (let i = 0; i < WARMUP_WRITES + BENCHMARK_WRITES; i += 1) {
    const start = now();
    store.write({ current: record });
    if (i >= WARMUP_WRITES) samples.push(now() - start);
  }
  return summarizeWriteTimes(samples);
}

/** The device's high-resolution clock in ms (this file is on the ESLint clock allow-list). */
export function deviceNow(): number {
  return performance.now();
}

/** The perf-log entry the debug menu appends after a run. */
export function saveBenchmarkEntry(result: SaveBenchmarkResult, atEpochMs: number): PerfEntry {
  return { kind: 'save-benchmark', label: 'save-write', atEpochMs, data: { ...result } };
}
