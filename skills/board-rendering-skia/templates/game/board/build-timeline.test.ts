// apps/__GAME_ID__/src/board/build-timeline.test.ts
import { timelineEndMs } from '@e07/game-kit/timeline/track.ts';

import { cellEntity } from './board-ids.ts';
import { buildTimeline, TURN_BUDGET_MS } from './build-timeline.ts';

import type { __GAME_PASCAL__Event } from '@e07/__GAME_ID__/rules/__GAME_ID__-types.ts';

/** The busiest turn the rules can produce: a plus-shaped flip that clears the board. */
const TURN: readonly __GAME_PASCAL__Event[] = [
  { kind: 'cells-flipped', cells: [7, 2, 6, 8, 12] },
  { kind: 'board-cleared' },
];

describe('buildTimeline', () => {
  it('keeps the busiest turn within the animation budget', () => {
    expect(timelineEndMs(buildTimeline(TURN, 'full'))).toBeLessThanOrEqual(TURN_BUDGET_MS);
  });

  it('turns every flipped cell over, the tapped cell first', () => {
    const flips = buildTimeline(TURN, 'full').filter((track) => track.channel === 'flip');
    expect(flips.map((track) => track.entityId)).toStrictEqual([7, 2, 6, 8, 12].map(cellEntity));
    expect(flips[0]?.startMs).toBeLessThan(flips[1]?.startMs ?? 0);
  });

  it('drops particles and overshoot under reduced motion', () => {
    const tracks = buildTimeline([...TURN, { kind: 'moves-added', count: 3 }], 'reduced');
    expect(tracks.some((track) => track.channel === 'burst')).toBe(false);
    expect(tracks.some((track) => track.easing === 'out-back')).toBe(false);
    expect(timelineEndMs(tracks)).toBeLessThan(timelineEndMs(buildTimeline(TURN, 'full')));
  });

  it('cues each beat with its sound and haptic', () => {
    const cues = buildTimeline([...TURN, { kind: 'moves-added', count: 3 }], 'full')
      .map((track) => track.cue)
      .filter((cue) => cue !== undefined);
    expect(cues).toStrictEqual([
      { sound: 'flip', haptic: 'light' },
      { sound: 'clear', haptic: 'success' },
      { sound: 'bonus', haptic: 'medium' },
    ]);
  });

  it('returns the same tracks for the same events', () => {
    expect(buildTimeline(TURN, 'full')).toStrictEqual(buildTimeline(TURN, 'full'));
  });
});
