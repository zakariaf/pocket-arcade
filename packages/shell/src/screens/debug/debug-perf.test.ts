// packages/shell/src/screens/debug/debug-perf.test.ts
import { perfSummaryOf, perfSummaryText } from './debug-perf.ts';

import type { PerfEntry } from '@e07/shell/app/perf/perf-log.ts';

const entry = (kind: PerfEntry['kind'], data: PerfEntry['data']): PerfEntry => ({
  kind,
  label: kind,
  atEpochMs: 1_790_000_000_000,
  data,
});

describe('perfSummaryOf', () => {
  it('counts the cold starts and shows the newest one and the newest save benchmark', () => {
    const entries = [
      entry('cold-start', { totalMs: 1_210 }),
      entry('save-benchmark', { p50: 0.3, p95: 0.62, max: 1.1 }),
      entry('cold-start', { totalMs: 1_049 }),
      entry('save-benchmark', { p50: 0.2, p95: 0.41, max: 0.9 }),
      entry('frames', { p95: 8.3 }),
    ];
    expect(perfSummaryOf(entries)).toStrictEqual({
      coldStarts: 2,
      lastColdStartMs: 1_049,
      saveP95Ms: 0.41,
    });
  });

  it('shows nothing measured yet on an empty log', () => {
    expect(perfSummaryOf([])).toStrictEqual({
      coldStarts: 0,
      lastColdStartMs: null,
      saveP95Ms: null,
    });
  });

  it('keeps a cold start without a process start time as null', () => {
    expect(perfSummaryOf([entry('cold-start', { totalMs: null })]).lastColdStartMs).toBeNull();
  });
});

describe('perfSummaryText', () => {
  it('reads as the cold starts, the newest one and the newest save p95', () => {
    expect(perfSummaryText({ coldStarts: 2, lastColdStartMs: 1_049, saveP95Ms: 0.41 })).toBe(
      'cold 2 · 1049 ms · save p95 0.41 ms',
    );
  });

  it('shows a dash for what was not measured yet', () => {
    expect(perfSummaryText({ coldStarts: 0, lastColdStartMs: null, saveP95Ms: null })).toBe(
      'cold 0 · – · save p95 –',
    );
  });
});
