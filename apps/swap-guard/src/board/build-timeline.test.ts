// apps/swap-guard/src/board/build-timeline.test.ts
// Spec 10 BOARD AND CONTROLS: "Animates the events (and respects Reduce motion)".
import { timelineEndMs } from '@e07/game-kit/timeline/track.ts';

import { cellEntity, enemyEntity, GUARD_ENTITY, TURN_ENTITY } from './board-ids.ts';
import { buildTimeline, TURN_BUDGET_MS } from './build-timeline.ts';

import type { SwapGuardEvent } from '@e07/swap-guard/rules/swap-guard-types.ts';

/** The busiest turn the rules make: a swap into a strike that knocks out two and hits the guard. */
const TURN: readonly SwapGuardEvent[] = [
  { kind: 'pieces-swapped', from: 22, to: 17, enemyId: 1 },
  {
    kind: 'strikes-landed',
    strikes: [
      { enemyId: 0, cells: [22] },
      { enemyId: 1, cells: [11, 23, 16] },
      { enemyId: 3, cells: [19, 18, 17] },
    ],
  },
  { kind: 'enemies-defeated', enemyIds: [0, 1], cells: [16, 22] },
  { kind: 'guard-hit', cell: 17, enemyIds: [3] },
];
const STEP: readonly SwapGuardEvent[] = [
  { kind: 'pieces-swapped', from: 7, to: 8, enemyId: null },
  { kind: 'strikes-landed', strikes: [] },
];
const BACK: readonly SwapGuardEvent[] = [
  { kind: 'swap-reversed', from: 17, to: 22, enemyId: 1, restoredIds: [0, 1] },
];

const channelsOf = (events: readonly SwapGuardEvent[]): string[] =>
  buildTimeline(events, 'full').map((track) => track.channel);

describe('buildTimeline', () => {
  it('keeps the busiest turn within the animation budget', () => {
    expect(timelineEndMs(buildTimeline(TURN, 'full'))).toBeLessThanOrEqual(TURN_BUDGET_MS);
  });

  it('slides the guard and the enemy it swapped with past each other', () => {
    const tracks = buildTimeline(TURN, 'full').slice(0, 2);
    expect(tracks.map((track) => [track.channel, track.entityId])).toStrictEqual([
      ['guard', GUARD_ENTITY],
      ['slide', enemyEntity(1)],
    ]);
    // The timeline knows no grid width: a slide carries both squares and its progress.
    expect([tracks[0]?.from, tracks[0]?.to]).toStrictEqual([
      [22, 17, 0],
      [22, 17, 1],
    ]);
    expect([tracks[1]?.from, tracks[1]?.to]).toStrictEqual([
      [17, 22, 0],
      [17, 22, 1],
    ]);
  });

  it('steps the guard alone onto an empty tile, then fades the new telegraph in', () => {
    expect(channelsOf(STEP)).toStrictEqual(['guard', 'telegraph']);
  });

  it('lands each strike once per square, knocks out each enemy with a burst, rings a hit guard', () => {
    expect(channelsOf(TURN)).toStrictEqual([
      'guard',
      'slide',
      'telegraph',
      'struck',
      'flash',
      'struck',
      'flash',
      'struck',
      'flash',
      'struck',
      'flash',
      'struck',
      'flash',
      'struck',
      'flash',
      'struck',
      'flash',
      'fall',
      'burst',
      'fall',
      'burst',
      'hit',
    ]);
    const struck = buildTimeline(TURN, 'full').filter((track) => track.channel === 'struck');
    expect(struck.map((track) => track.entityId)).toStrictEqual(
      [22, 11, 23, 16, 19, 18, 17].map(cellEntity),
    );
    const fall = buildTimeline(TURN, 'full').filter((track) => track.channel === 'fall');
    expect(fall.map((track) => [track.entityId, track.from, track.to])).toStrictEqual([
      [enemyEntity(0), [1], [0]],
      [enemyEntity(1), [1], [0]],
    ]);
  });

  it('starts the strikes after the swap and the knock-outs after the strikes', () => {
    const tracks = buildTimeline(TURN, 'full');
    const startOf = (channel: string): number =>
      tracks.find((track) => track.channel === channel)?.startMs ?? -1;
    expect(startOf('guard')).toBe(0);
    expect(startOf('struck')).toBeGreaterThanOrEqual(200);
    expect(startOf('fall')).toBeGreaterThan(startOf('struck'));
    expect(startOf('telegraph')).toBeGreaterThan(startOf('fall'));
  });

  it('drops particles and overshoot under reduced motion, and is shorter', () => {
    const tracks = buildTimeline([...TURN, ...BACK], 'reduced');
    expect(tracks.some((track) => track.channel === 'burst')).toBe(false);
    expect(tracks.some((track) => track.easing === 'out-back')).toBe(false);
    expect(timelineEndMs(buildTimeline(TURN, 'reduced'))).toBeLessThan(
      timelineEndMs(buildTimeline(TURN, 'full')),
    );
  });

  it('cues each beat with its sound and haptic', () => {
    const cues = buildTimeline([...TURN, ...BACK], 'full')
      .map((track) => track.cue)
      .filter((cue) => cue !== undefined);
    expect(cues).toStrictEqual([
      { sound: 'swap', haptic: 'selection' },
      { sound: 'strike', haptic: 'light' },
      { sound: 'hit', haptic: 'success' },
      { haptic: 'error' },
      { sound: 'swap', haptic: 'medium' },
    ]);
  });

  it('turns the continue into the swap undone and the knocked-out enemies standing again', () => {
    const tracks = buildTimeline(BACK, 'full');
    expect(tracks.map((track) => [track.channel, track.entityId])).toStrictEqual([
      ['guard', GUARD_ENTITY],
      ['slide', enemyEntity(1)],
      ['telegraph', TURN_ENTITY],
      ['rise', enemyEntity(0)],
      ['rise', enemyEntity(1)],
    ]);
    expect(tracks[3]?.from).toStrictEqual([0]);
    expect(tracks[3]?.to).toStrictEqual([1]);
  });

  it('returns the same tracks for the same events', () => {
    expect(buildTimeline(TURN, 'full')).toStrictEqual(buildTimeline(TURN, 'full'));
  });
});
