// apps/line-siege/src/board/build-timeline.test.ts
import { timelineEndMs } from '@e07/game-kit/timeline/track.ts';
import { applyMove } from '@e07/line-siege/rules/apply-move.ts';
import { create } from '@e07/line-siege/rules/create.ts';

import { heartEntity, TURN_ENTITY } from './board-ids.ts';
import { TURN_BUDGET_MS, buildTimeline } from './build-timeline.ts';

import type { LineSiegeEvent } from '@e07/line-siege/rules/line-siege-types.ts';

/** The busiest turn the rules produce: a placement, a row and a column, every monster event. */
const TURN: readonly LineSiegeEvent[] = [
  { kind: 'block-placed', trayIndex: 1, piece: 2, cells: [31, 39] },
  { kind: 'row-cleared', row: 4 },
  { kind: 'column-cleared', col: 7 },
  { kind: 'beam-fired', lane: 7, targetId: 1 },
  { kind: 'monster-hit', monsterId: 1, damage: 8, hpLeft: 0 },
  { kind: 'shockwave-sent', rows: 1, damage: 2 },
  { kind: 'monster-hit', monsterId: 2, damage: 2, hpLeft: 3 },
  { kind: 'monster-defeated', monsterId: 1, monsterKind: 'normal', lane: 7, row: 2 },
  { kind: 'score-added', points: 65, total: 65 },
  { kind: 'monster-moved', monsterId: 2, fromRow: 5, toRow: 6 },
  { kind: 'wall-breached', monsterId: 2, monsterKind: 'fast', lane: 3, heartsLeft: 2 },
  { kind: 'monster-spawned', monsterId: 4, monsterKind: 'armoured', lane: 0, hp: 6 },
  { kind: 'tray-refilled', tray: [0, 5, 9] },
];

describe('buildTimeline', () => {
  it('keeps the busiest turn within the animation budget', () => {
    expect(timelineEndMs(buildTimeline(TURN, 'full'))).toBeLessThanOrEqual(TURN_BUDGET_MS);
  });

  it('drops particles, shake and overshoot under reduced motion, and plays shorter', () => {
    const tracks = buildTimeline(TURN, 'reduced');
    expect(tracks.some((track) => ['burst', 'shake'].includes(track.channel))).toBe(false);
    expect(tracks.some((track) => track.easing === 'out-back')).toBe(false);
    expect(timelineEndMs(tracks)).toBeLessThan(timelineEndMs(buildTimeline(TURN, 'full')));
  });

  it('cues the place sound and a light haptic once per placed block', () => {
    const cues = buildTimeline(TURN, 'full').filter((track) => track.cue?.sound === 'place');
    expect(cues.map((track) => track.cue)).toStrictEqual([{ sound: 'place', haptic: 'light' }]);
  });

  it('fades out every cleared cell once, even where the row and the column cross', () => {
    const cleared = buildTimeline(TURN, 'full').filter((track) => track.channel === 'clear');
    expect(cleared).toHaveLength(15);
  });

  it('lets a breaching monster walk into the wall from the row it marched from', () => {
    const breach = buildTimeline(TURN, 'full').find(
      (track) => track.channel === 'vanish' && track.entityId === 2,
    );
    expect([breach?.from, breach?.to]).toStrictEqual([
      [3, 5, 2, 1],
      [3, 6, 2, 0],
    ]);
  });

  it('cues only the six sounds of the bank, each with its haptic', () => {
    const cues = buildTimeline(TURN, 'full').flatMap((track) => (track.cue ? [track.cue] : []));
    expect(cues).toStrictEqual([
      { sound: 'place', haptic: 'light' },
      { sound: 'beam', haptic: 'medium' },
      { sound: 'hit' },
      { sound: 'shock' },
      { sound: 'hit' },
      { sound: 'pop', haptic: 'success' },
      { sound: 'breach', haptic: 'warning' },
    ]);
  });

  it('shrinks away the heart a breach costs', () => {
    const heart = buildTimeline(TURN, 'full').find((track) => track.channel === 'heart');
    expect([heart?.entityId, heart?.from, heart?.to]).toStrictEqual([heartEntity(2), [1], [0]]);
  });

  it('plays the continue silently: a heart pops, the lanes sweep, the emptied rows fade', () => {
    const events: readonly LineSiegeEvent[] = [
      { kind: 'heart-restored', hearts: 1 },
      { kind: 'monsters-pushed-back', rows: 3 },
      { kind: 'rows-emptied', rows: [6, 7] },
    ];
    const tracks = buildTimeline(events, 'full');
    expect(tracks.filter((track) => track.cue !== undefined)).toStrictEqual([]);
    expect(tracks.find((track) => track.channel === 'heart')?.entityId).toBe(heartEntity(0));
    expect(tracks.find((track) => track.channel === 'push')?.entityId).toBe(TURN_ENTITY);
    expect(tracks.filter((track) => track.channel === 'clear')).toHaveLength(16);
  });

  it('returns the same tracks for the same events, including a real opening move', () => {
    const events = applyMove(create(1, 0), {
      kind: 'place-block',
      trayIndex: 1,
      col: 7,
      row: 3,
    }).events;
    expect(buildTimeline(events, 'full')).toStrictEqual(buildTimeline(events, 'full'));
    expect(buildTimeline(events, 'full').some((track) => track.channel === 'beam')).toBe(true);
  });
});
