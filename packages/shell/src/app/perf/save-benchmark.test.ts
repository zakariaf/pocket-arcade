// packages/shell/src/app/perf/save-benchmark.test.ts
import {
  BENCHMARK_DB_FILE,
  BENCHMARK_WRITES,
  runSaveBenchmark,
  saveBenchmarkEntry,
  summarizeWriteTimes,
} from './save-benchmark.ts';

import type { SaveStore, SlotRecord } from '@e07/shell/services/save/save-store.ts';

const RECORD: SlotRecord = {
  schemaVersion: 1,
  appVersion: '1.0.0',
  writtenAtMs: 1_790_000_000_000,
  writeCount: 1,
  checksum: '00000000',
  payload: '{}',
};

describe('save benchmark', () => {
  it('writes into its own scratch database, never the player save', () => {
    expect(BENCHMARK_DB_FILE).toBe('perf-bench.db');
    expect(BENCHMARK_DB_FILE).not.toBe('save.db');
  });

  it('summarizes p50, p95 and max of the write times, and how many writes were timed', () => {
    const samples = Array.from({ length: 100 }, (_, i) => (i + 1) / 10);
    expect(summarizeWriteTimes(samples)).toStrictEqual({ p50: 5, p95: 9.5, max: 10, writes: 100 });
  });

  it('times only the writes after the warm-up, on the store it is given', () => {
    let writes = 0;
    const store: SaveStore = {
      read: () => null,
      write: () => {
        writes += 1;
      },
      quarantine: () => undefined,
      checkpoint: () => undefined,
      newerStructureVersion: () => null,
    };
    let clock = 0;
    const now = (): number => {
      clock += 0.5; // every now() call advances 0.5 ms, so each write measures 0.5 ms
      return clock;
    };
    const result = runSaveBenchmark({ store, record: RECORD, now });
    expect(writes).toBe(BENCHMARK_WRITES + 20);
    expect(result).toStrictEqual({ p50: 0.5, p95: 0.5, max: 0.5, writes: BENCHMARK_WRITES });
    // check-e2e-report (rule save-benchmark) reads data.writes and data.p95 from this entry.
    expect(saveBenchmarkEntry(result, 1)).toStrictEqual({
      kind: 'save-benchmark',
      label: 'save-write',
      atEpochMs: 1,
      data: { p50: 0.5, p95: 0.5, max: 0.5, writes: 300 },
    });
  });
});
