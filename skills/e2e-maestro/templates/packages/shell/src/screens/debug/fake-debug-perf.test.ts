// packages/shell/src/screens/debug/fake-debug-perf.test.ts
import { createFakeDebugPerf } from './fake-debug-perf.ts';

import type { PerfEntry } from '@e07/shell/app/perf/perf-log.ts';

describe('createFakeDebugPerf', () => {
  it('keeps the recording switch, lists every call and logs one benchmark entry', async () => {
    const entries: PerfEntry[] = [];
    const perf = createFakeDebugPerf({
      append: (entry) => entries.push(entry),
      entries: () => entries,
    });

    perf.setRecording(true);
    expect(perf.isRecording()).toBe(true);
    await perf.share();
    perf.runSaveBenchmark();

    expect(perf.calls).toStrictEqual(['record on', 'share', 'benchmark']);
    expect(entries.map((entry) => entry.kind)).toStrictEqual(['save-benchmark']);
  });

  it('runs the benchmark without a log', () => {
    const perf = createFakeDebugPerf();
    perf.runSaveBenchmark();
    perf.setRecording(false);
    expect(perf.calls).toStrictEqual(['benchmark', 'record off']);
  });
});
