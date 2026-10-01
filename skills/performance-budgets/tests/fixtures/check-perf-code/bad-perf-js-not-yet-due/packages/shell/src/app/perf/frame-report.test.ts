// packages/shell/src/app/perf/frame-report.test.ts
import { createFrameHistogram, recordFrame } from './frame-histogram.ts';
import { summarizeFrames } from './frame-report.ts';

import type { FrameHistogram } from './frame-histogram.ts';

function record(intervalsMs: readonly number[]): FrameHistogram {
  return intervalsMs.reduce(recordFrame, createFrameHistogram());
}

describe('summarizeFrames', () => {
  it('returns null when no frame was recorded', () => {
    expect(summarizeFrames(createFrameHistogram())).toBeNull();
  });

  it('reports a clean 120 Hz second as hitch-free', () => {
    const report = summarizeFrames(record(Array.from({ length: 120 }, () => 1000 / 120)));
    expect(report).toMatchObject({ refreshHz: 120, p95UpToMs: 9, hitchMsPerS: 0 });
  });

  it('charges one 50 ms stall as 41.7 ms of hitch at 120 Hz', () => {
    const intervals = [...Array.from({ length: 114 }, () => 1000 / 120), 50];
    const report = summarizeFrames(record(intervals));
    expect(report?.maxMs).toBe(50);
    expect(report?.hitchMsPerS).toBeCloseTo(41.7, 1);
  });

  it('ignores the null first-frame interval (recorded as 0)', () => {
    expect(record([0, 16.7]).frames).toBe(1);
  });
});
