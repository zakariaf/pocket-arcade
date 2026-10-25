// apps/trail-clear/src/board/build-timeline.test.ts
// Spec 13 (trail-clear): "closing a road or river loop scores it and wipes those tiles". Each event
// of a placement becomes a short animation with its sound: the tile lands, its loops close, a
// double bursts, the wiped tiles shrink away, the next tile grows into the tray.
import { timelineEndMs } from '@e07/game-kit/timeline/track.ts';
import { applyMove } from '@e07/trail-clear/rules/apply-move.ts';
import { create } from '@e07/trail-clear/rules/create.ts';

import { cellEntity, slotEntity, TURN_ENTITY } from './board-ids.ts';
import { TURN_BUDGET_MS, buildTimeline } from './build-timeline.ts';

import type { TrailClearEvent } from '@e07/trail-clear/rules/trail-clear-types.ts';

/** The busiest turn of greedy play (seed 53, endless, placement 32): a ford closes a double. */
const TURN: readonly TrailClearEvent[] = [
  { kind: 'tile-placed', tile: 'ford', turns: 0, cell: 15 },
  { kind: 'loop-closed', terrain: 'road', cells: [10, 11, 15], points: 90 },
  { kind: 'loop-closed', terrain: 'river', cells: [15, 20, 21], points: 90 },
  { kind: 'double-closed', bonus: 180 },
  {
    kind: 'tiles-wiped',
    cells: [10, 11, 15, 20, 21],
    tiles: [
      { kind: 'road-bend', turns: 1 },
      { kind: 'ford', turns: 3 },
      { kind: 'ford', turns: 0 },
      { kind: 'river-bend', turns: 0 },
      { kind: 'river-end', turns: 3 },
    ],
  },
  { kind: 'score-added', points: 360, total: 940 },
  { kind: 'tile-dealt', tile: 'road-bend' },
];

/** The continue clears row 0: a road end, a road straight and a road end. */
const CLEARED: TrailClearEvent = {
  kind: 'rows-cleared',
  rows: [0],
  cells: [0, 1, 3],
  tiles: [
    { kind: 'road-end', turns: 1 },
    { kind: 'road-straight', turns: 1 },
    { kind: 'road-end', turns: 3 },
  ],
};

describe('buildTimeline', () => {
  it('keeps the busiest turn within the animation budget', () => {
    expect(timelineEndMs(buildTimeline(TURN, 'full'))).toBeLessThanOrEqual(TURN_BUDGET_MS);
  });

  it('drops particles and overshoot under reduced motion, and plays shorter', () => {
    const tracks = buildTimeline(TURN, 'reduced');
    expect(tracks.some((track) => track.channel === 'burst')).toBe(false);
    expect(tracks.some((track) => track.easing === 'out-back')).toBe(false);
    expect(timelineEndMs(tracks)).toBeLessThan(timelineEndMs(buildTimeline(TURN, 'full')));
  });

  it('cues the sounds in the order the turn plays them, each with its haptic', () => {
    const cues = buildTimeline(TURN, 'full').flatMap((track) =>
      track.cue === undefined ? [] : [track.cue],
    );
    expect(cues).toStrictEqual([
      { sound: 'place', haptic: 'light' },
      { sound: 'loop', haptic: 'success' },
      { sound: 'loop', haptic: 'success' },
      { sound: 'double', haptic: 'heavy' },
      { sound: 'wipe' },
    ]);
  });

  it('shrinks every wiped tile away once, after its loops have closed', () => {
    const tracks = buildTimeline(TURN, 'full');
    const wipes = tracks.filter((track) => track.channel === 'wipe');
    const loops = tracks.filter((track) => track.channel === 'loop');
    expect(wipes.map((track) => track.entityId)).toStrictEqual(
      [10, 11, 15, 20, 21].map(cellEntity),
    );
    expect(wipes.map((track) => [track.from, track.to])[0]).toStrictEqual([[1], [0]]);
    expect(Math.min(...wipes.map((track) => track.startMs))).toBeGreaterThan(
      Math.max(...loops.map((track) => track.startMs)),
    );
  });

  it('bursts the double from the cell the tile was placed on', () => {
    const tracks = buildTimeline(TURN, 'full');
    const burst = tracks.find((track) => track.channel === 'burst');
    const ring = tracks.find((track) => track.channel === 'double');
    expect([burst?.entityId, burst?.from[0], ring?.from[0]]).toStrictEqual([TURN_ENTITY, 15, 15]);
  });

  it('grows the dealt tile into one tray slot per distinct turn', () => {
    const bend = buildTimeline(TURN, 'full').filter((track) => track.channel === 'tray');
    const straight = buildTimeline([{ kind: 'tile-dealt', tile: 'road-straight' }], 'full');
    expect(bend.map((track) => track.entityId)).toStrictEqual([0, 1, 2, 3].map(slotEntity));
    expect(straight.map((track) => track.entityId)).toStrictEqual([0, 1].map(slotEntity));
  });

  it('plays the continue silently: the cleared rows shrink away', () => {
    const tracks = buildTimeline([CLEARED], 'full');
    expect(tracks.map((track) => [track.channel, track.entityId])).toStrictEqual([
      ['wipe', cellEntity(0)],
      ['wipe', cellEntity(1)],
      ['wipe', cellEntity(3)],
    ]);
    expect(tracks.filter((track) => track.cue !== undefined)).toStrictEqual([]);
  });

  it('pops a placed tile that closes nothing, and stays still for the score line', () => {
    const tracks = buildTimeline(
      [
        { kind: 'tile-placed', tile: 'road-end', turns: 2, cell: 4 },
        { kind: 'score-added', points: 40, total: 40 },
      ],
      'full',
    );
    expect(
      tracks.map((track) => [track.channel, track.entityId, track.from, track.to]),
    ).toStrictEqual([['place', cellEntity(4), [0.6], [1]]]);
  });

  it('returns the same tracks for the same events, including the opening double of seed 1', () => {
    const { events } = applyMove(create(1, 0), { kind: 'place-tile', turns: 1, col: 3, row: 2 });
    expect(buildTimeline(events, 'full')).toStrictEqual(buildTimeline(events, 'full'));
    expect(buildTimeline(events, 'full').some((track) => track.channel === 'double')).toBe(true);
  });
});
