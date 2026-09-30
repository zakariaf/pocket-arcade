// apps/demo-grid/src/board/build-timeline.test.ts
import { timelineEndMs } from '@e07/game-kit/timeline/track.ts';

import { buildTimeline, TURN_BUDGET_MS } from './build-timeline.ts';

import type { DemoGridEvent } from '@e07/demo-grid/rules/demo-grid-types.ts';

/** The busiest turn the rules can produce (every event kind at once). */
const TURN: readonly DemoGridEvent[] = [
  { kind: 'cell-filled', col: 2, row: 5 },
  { kind: 'piece-moved', pieceId: 1, fromCol: 0, fromRow: 0, toCol: 0, toRow: 3 },
  { kind: 'piece-removed', pieceId: 2, col: 4, row: 4 },
];

describe('buildTimeline', () => {
  it('keeps the busiest turn within the animation budget', () => {
    expect(timelineEndMs(buildTimeline(TURN, 'full'))).toBeLessThanOrEqual(TURN_BUDGET_MS);
  });

  it('drops particles and overshoot under reduced motion', () => {
    const tracks = buildTimeline(TURN, 'reduced');
    expect(tracks.some((track) => track.channel === 'burst')).toBe(false);
    expect(tracks.some((track) => track.easing === 'out-back')).toBe(false);
    expect(timelineEndMs(tracks)).toBeLessThan(timelineEndMs(buildTimeline(TURN, 'full')));
  });

  it('cues a sound and a haptic when a cell fills', () => {
    const [first] = buildTimeline(TURN, 'full');
    expect(first?.cue).toStrictEqual({ sound: 'place', haptic: 'light' });
  });

  it('returns the same tracks for the same events', () => {
    expect(buildTimeline(TURN, 'full')).toStrictEqual(buildTimeline(TURN, 'full'));
  });
});
