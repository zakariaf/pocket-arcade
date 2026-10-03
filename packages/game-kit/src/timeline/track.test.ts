// packages/game-kit/src/timeline/track.test.ts
import { ease, timelineEndMs } from './track.ts';

import type { EasingId, Track } from './track.ts';

const EASINGS: readonly EasingId[] = [
  'linear',
  'in-quad',
  'out-quad',
  'in-out-quad',
  'out-cubic',
  'out-back',
];

describe('ease', () => {
  it.each(EASINGS)('maps 0 to 0 and 1 to 1 for %s', (easing) => {
    expect(ease(easing, 0)).toBeCloseTo(0, 10);
    expect(ease(easing, 1)).toBeCloseTo(1, 10);
  });

  it('passes the middle of in-out-quad at one half', () => {
    expect(ease('in-out-quad', 0.5)).toBe(0.5);
  });

  it('overshoots with out-back before settling', () => {
    expect(ease('out-back', 0.7)).toBeGreaterThan(1);
  });
});

describe('timelineEndMs', () => {
  const track = (startMs: number, durationMs: number): Track => ({
    channel: 'pos',
    entityId: 1,
    startMs,
    durationMs,
    easing: 'linear',
    from: [0],
    to: [1],
  });

  it('returns the latest end over all tracks', () => {
    expect(timelineEndMs([track(0, 100), track(120, 200), track(50, 10)])).toBe(320);
  });

  it('returns 0 for no tracks', () => {
    expect(timelineEndMs([])).toBe(0);
  });
});
