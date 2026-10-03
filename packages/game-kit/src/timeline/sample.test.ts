// packages/game-kit/src/timeline/sample.test.ts
import { EMPTY_FX, fxEntry, sampleTimeline } from './sample.ts';

import type { Track } from './track.ts';

const hop = (startMs: number, from: number, to: number): Track => ({
  channel: 'row',
  entityId: 7,
  startMs,
  durationMs: 100,
  easing: 'linear',
  from: [from],
  to: [to],
});

describe('sampleTimeline', () => {
  it('samples a turn without tracks as EMPTY_FX: draw() shows the final state', () => {
    expect(sampleTimeline([], 0)).toStrictEqual(EMPTY_FX);
    expect(fxEntry(EMPTY_FX, 'row', 7)).toBeUndefined();
  });

  it('holds the first hop start value before anything begins', () => {
    const fx = sampleTimeline([hop(200, 3, 4), hop(100, 2, 3)], 50);
    expect(fxEntry(fx, 'row', 7)?.values).toStrictEqual([2]);
  });

  it('follows the latest hop that has started (multi-jump chains)', () => {
    const fx = sampleTimeline([hop(0, 1, 2), hop(100, 2, 3)], 150);
    expect(fxEntry(fx, 'row', 7)?.values).toStrictEqual([2.5]);
  });

  it('ends exactly on the target values', () => {
    const fx = sampleTimeline([hop(0, 1, 2)], 10_000);
    expect(fxEntry(fx, 'row', 7)).toStrictEqual({ values: [2], progress: 1, ageMs: 100 });
  });
});
