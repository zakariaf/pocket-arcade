// packages/game-kit/src/timeline/sample.test.ts
import {
  EMPTY_FX,
  fxEntry,
  playingAt,
  playingEntry,
  sampleTimeline,
  sampleTrack,
} from './sample.ts';

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
    expect(fxEntry(fx, 'row', 7)).toStrictEqual({
      values: [2],
      progress: 1,
      ageMs: 100,
      linear: 1,
    });
  });
});

describe('sampleTrack', () => {
  it('gives the linear time of the track: 0 before it starts, its share of time, 1 once it ended', () => {
    const pop: Track = { ...hop(100, 0, 1), easing: 'out-back' };
    expect(
      [0, 100, 125, 160, 200, 10_000].map((atMs) => sampleTrack(pop, atMs).linear),
    ).toStrictEqual([0, 0, 0.25, 0.6, 1, 1]);
    expect(sampleTrack({ ...pop, durationMs: 0 }, 0).linear).toBe(1);
  });
});

describe('playingEntry', () => {
  // A flash, glow or burst draws only while its track plays. An out-back track's eased progress passes
  // 1 early (at about 37 % of its time) and overshoots, so "playing" is read from the linear time.
  const pop: Track = { ...hop(100, 0, 1), easing: 'out-back' };

  it('keeps an out-back track playing through its overshoot, until its linear time ends', () => {
    for (const atMs of [110, 140, 160, 199]) {
      expect(playingEntry(sampleTimeline([pop], atMs), 'row', 7)).toBeDefined();
    }
    expect(fxEntry(sampleTimeline([pop], 160), 'row', 7)?.progress).toBeGreaterThan(1);
  });

  it('gives nothing before the track starts, once it has ended, or for a key without a track', () => {
    for (const atMs of [0, 100, 200, 10_000]) {
      expect(playingEntry(sampleTimeline([pop], atMs), 'row', 7)).toBeUndefined();
    }
    expect(playingEntry(sampleTimeline([pop], 150), 'row', 8)).toBeUndefined();
    expect(playingEntry(EMPTY_FX, 'row', 7)).toBeUndefined();
  });

  it('reads the linear time of the active track: 0.5 halfway through an out-back pop', () => {
    expect(fxEntry(sampleTimeline([pop], 150), 'row', 7)?.linear).toBe(0.5);
    expect(sampleTimeline([pop], 150)).toStrictEqual({
      elapsedMs: 150,
      entries: { 'row:7': sampleTrack(pop, 150) },
    });
    expect(playingEntry(sampleTimeline([pop], 150), 'row', 7)?.ageMs).toBe(50);
  });
});

describe('playingAt', () => {
  // Effect layers that walk every key of a channel (burst:<id>, spark:<id>) read "playing" by key.
  const pop: Track = { ...hop(100, 0, 1), easing: 'out-back' };

  it('gives a key the entry playingEntry gives its channel and entity, at every moment', () => {
    for (const atMs of [0, 100, 110, 150, 160, 199, 200, 10_000]) {
      const fx = sampleTimeline([pop], atMs);
      expect(playingAt(fx, 'row:7')).toBe(playingEntry(fx, 'row', 7));
    }
  });

  it('keeps an out-back key playing through its overshoot, and nothing for an unknown key', () => {
    const fx = sampleTimeline([pop], 160);
    expect(playingAt(fx, 'row:7')?.values).toStrictEqual(fxEntry(fx, 'row', 7)?.values);
    expect(playingAt(fx, 'row:8')).toBeUndefined();
    expect(playingAt(EMPTY_FX, 'row:7')).toBeUndefined();
  });
});
