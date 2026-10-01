// packages/shell/src/app/perf/frame-report.ts
import { BUCKET_BOUNDS_MS } from './frame-histogram.ts';

import type { FrameHistogram } from './frame-histogram.ts';

export type FrameReport = {
  readonly frames: number;
  readonly seconds: number;
  readonly refreshHz: 60 | 120;
  readonly p50UpToMs: number;
  readonly p95UpToMs: number;
  readonly maxMs: number;
  /** Apple's metric: ms of hitch per second. Good <= 10, warning <= 25, critical <= 50. */
  readonly hitchMsPerS: number;
  readonly buckets: readonly number[];
};

function percentileBound(buckets: readonly number[], frames: number, p: number): number {
  let seen = 0;
  for (const [index, count] of buckets.entries()) {
    seen += count;
    if (seen >= (p / 100) * frames) return BUCKET_BOUNDS_MS[index] ?? Number.POSITIVE_INFINITY;
  }
  return Number.POSITIVE_INFINITY;
}

/** Pure, JS thread: turns a finished histogram into the numbers the owner exports. */
export function summarizeFrames(histogram: FrameHistogram): FrameReport | null {
  if (histogram.frames === 0) return null;
  const isProMotion = histogram.minMs < 12;
  const hitchMs = isProMotion ? histogram.hitchMs120 : histogram.hitchMs60;
  const seconds = histogram.totalMs / 1000;
  return {
    frames: histogram.frames,
    seconds: Math.round(seconds * 10) / 10,
    refreshHz: isProMotion ? 120 : 60,
    p50UpToMs: percentileBound(histogram.buckets, histogram.frames, 50),
    p95UpToMs: percentileBound(histogram.buckets, histogram.frames, 95),
    maxMs: Math.round(histogram.maxMs),
    hitchMsPerS: Math.round((hitchMs / seconds) * 10) / 10,
    buckets: [...histogram.buckets],
  };
}
