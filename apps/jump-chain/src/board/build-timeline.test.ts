// apps/jump-chain/src/board/build-timeline.test.ts
import { sampleTimeline, fxEntry } from '@e07/game-kit/timeline/sample.ts';
import { timelineEndMs } from '@e07/game-kit/timeline/track.ts';

import { enemyEntity, TURN_ENTITY } from './board-ids.ts';
import { buildTimeline, TURN_BUDGET_MS } from './build-timeline.ts';

import type { Track } from '@e07/game-kit/timeline/track.ts';
import type { JumpChainEvent } from '@e07/jump-chain/rules/jump-chain-types.ts';

/** A chain of `count` jumps zig-zagging up the board; enemy k is the k-th one jumped. */
function chain(count: number): JumpChainEvent[] {
  return Array.from({ length: count }, (_, index) => ({
    kind: 'piece-jumped' as const,
    from: { col: index % 2 === 0 ? 1 : 3, row: 9 - 2 * index },
    to: { col: index % 2 === 0 ? 3 : 1, row: 7 - 2 * index },
    enemyId: index,
    jump: index + 1,
  }));
}

/**
 * The busiest turn the rules can produce: a long chain that clears two ranks, the due advance, an
 * empty board that pulls the waiting rank in, a new endless rank, and an overrun.
 */
const BUSIEST: readonly JumpChainEvent[] = [
  ...chain(8),
  { kind: 'enemies-captured', enemyIds: [0, 1, 2, 3, 4, 5, 6, 7], chain: 8, points: 360 },
  { kind: 'rank-cleared', rank: 0, points: 50 },
  { kind: 'rank-cleared', rank: 1, points: 50 },
  {
    kind: 'ranks-advanced',
    shifts: [
      { enemyId: 20, col: 1, fromRow: 7, toRow: 9 },
      { enemyId: 21, col: 3, fromRow: -1, toRow: 1 },
    ],
  },
  {
    kind: 'ranks-advanced',
    shifts: [{ enemyId: 21, col: 3, fromRow: 1, toRow: 3 }],
  },
  { kind: 'rank-spawned', rank: 4, enemies: [{ id: 30, rank: 4, col: 5, row: -1 }] },
  { kind: 'side-reached', enemyIds: [20] },
];

function channel(tracks: readonly Track[], name: string): readonly Track[] {
  return tracks.filter((track) => track.channel === name);
}

function endOf(track: Track | undefined): number {
  return track === undefined ? Number.NaN : track.startMs + track.durationMs;
}

describe('buildTimeline', () => {
  it('keeps the busiest turn within the animation budget', () => {
    expect(timelineEndMs(buildTimeline(BUSIEST, 'full'))).toBeLessThanOrEqual(TURN_BUDGET_MS);
  });

  it('speeds a long chain up so that even the longest chain fits the budget', () => {
    const long = buildTimeline(chain(40), 'full');
    const short = buildTimeline(chain(2), 'full');
    expect(timelineEndMs(long)).toBeLessThanOrEqual(TURN_BUDGET_MS);
    expect(channel(long, 'piece')[0]?.durationMs).toBeLessThan(
      channel(short, 'piece')[0]?.durationMs ?? 0,
    );
  });

  it('moves the piece one jump after another and pops each enemy as the piece passes it', () => {
    const tracks = buildTimeline(chain(3), 'full');
    const moves = channel(tracks, 'piece');
    expect(moves.map((track) => [track.entityId, track.from, track.to])).toStrictEqual([
      [TURN_ENTITY, [1, 9], [3, 7]],
      [TURN_ENTITY, [3, 7], [1, 5]],
      [TURN_ENTITY, [1, 5], [3, 3]],
    ]);
    expect(moves.map((track) => track.startMs)).toStrictEqual([
      0,
      endOf(moves[0]),
      endOf(moves[1]),
    ]);
    const pops = channel(tracks, 'pop');
    expect(pops.map((track) => [track.entityId, track.from])).toStrictEqual([
      [enemyEntity(0), [2, 8, 1]],
      [enemyEntity(1), [2, 6, 1]],
      [enemyEntity(2), [2, 4, 1]],
    ]);
    pops.forEach((pop, index) => {
      expect(pop.startMs).toBeGreaterThan(moves[index]?.startMs ?? Number.NaN);
      expect(pop.startMs).toBeLessThan(endOf(moves[index]));
    });
  });

  it('keeps each jumped enemy whole on its square until the piece passes it', () => {
    const fx = sampleTimeline(buildTimeline(chain(3), 'full'), 0);
    expect(fxEntry(fx, 'pop', enemyEntity(2))?.values).toStrictEqual([2, 4, 1]);
    expect(fxEntry(fx, 'piece', TURN_ENTITY)?.values).toStrictEqual([1, 9]);
  });

  it('slides a step one square', () => {
    const tracks = buildTimeline(
      [{ kind: 'piece-stepped', from: { col: 3, row: 7 }, to: { col: 2, row: 6 } }],
      'full',
    );
    expect(tracks.map((track) => [track.channel, track.from, track.to])).toStrictEqual([
      ['piece', [3, 7], [2, 6]],
    ]);
  });

  it('marches the ranks after the move, a second advance after the first', () => {
    const tracks = buildTimeline(BUSIEST, 'full');
    const marches = channel(tracks, 'march');
    expect(marches.map((track) => [track.entityId, track.from, track.to])).toStrictEqual([
      [enemyEntity(20), [7], [9]],
      [enemyEntity(21), [-1], [1]],
      [enemyEntity(21), [1], [3]],
    ]);
    const lastJump = channel(tracks, 'piece').at(-1);
    expect(marches[0]?.startMs).toBeGreaterThanOrEqual(endOf(lastJump));
    expect(marches[2]?.startMs).toBeGreaterThanOrEqual(endOf(marches[1]));
  });

  it('grows a new rank in after the advances, and flashes the overrun last', () => {
    const tracks = buildTimeline(BUSIEST, 'full');
    const lastMarch = channel(tracks, 'march').at(-1);
    const spawn = channel(tracks, 'spawn');
    expect(spawn.map((track) => [track.entityId, track.from, track.to])).toStrictEqual([
      [enemyEntity(30), [0], [1]],
    ]);
    expect(spawn[0]?.startMs).toBeGreaterThanOrEqual(endOf(lastMarch));
    const breach = channel(tracks, 'breach');
    expect(breach.map((track) => track.entityId)).toStrictEqual([enemyEntity(20)]);
    expect(breach[0]?.startMs).toBeGreaterThanOrEqual(endOf(lastMarch));
  });

  it('glows once when ranks are cleared, however many', () => {
    expect(channel(buildTimeline(BUSIEST, 'full'), 'clear')).toHaveLength(1);
  });

  it('steps the ranks back at once for the continue', () => {
    const tracks = buildTimeline(
      [
        {
          kind: 'ranks-stepped-back',
          shifts: [
            { enemyId: 4, col: 1, fromRow: 9, toRow: 7 },
            { enemyId: 5, col: 3, fromRow: 5, toRow: 3 },
          ],
        },
      ],
      'full',
    );
    expect(
      tracks.map((track) => [track.channel, track.startMs, track.from, track.to]),
    ).toStrictEqual([
      ['march', 0, [9], [7]],
      ['march', 0, [5], [3]],
    ]);
  });

  it('drops particles and overshoot under reduced motion', () => {
    const tracks = buildTimeline(BUSIEST, 'reduced');
    expect(tracks.some((track) => track.channel === 'burst')).toBe(false);
    expect(tracks.some((track) => track.easing === 'out-back')).toBe(false);
    expect(timelineEndMs(tracks)).toBeLessThan(timelineEndMs(buildTimeline(BUSIEST, 'full')));
  });

  it('cues each beat with its sound and haptic', () => {
    const cues = buildTimeline(
      [
        { kind: 'piece-stepped', from: { col: 3, row: 7 }, to: { col: 2, row: 6 } },
        ...BUSIEST,
        { kind: 'ranks-stepped-back', shifts: [{ enemyId: 4, col: 1, fromRow: 9, toRow: 7 }] },
      ],
      'full',
    )
      .map((track) => track.cue)
      .filter((cue) => cue !== undefined);
    expect(cues).toStrictEqual([
      { sound: 'step', haptic: 'selection' },
      ...Array.from({ length: 8 }, () => ({ sound: 'capture', haptic: 'light' })),
      { sound: 'clear', haptic: 'success' },
      { sound: 'march', haptic: 'medium' },
      { sound: 'march', haptic: 'medium' },
      { sound: 'overrun', haptic: 'error' },
      { sound: 'march', haptic: 'medium' },
    ]);
  });

  it('returns the same tracks for the same events', () => {
    expect(buildTimeline(BUSIEST, 'full')).toStrictEqual(buildTimeline(BUSIEST, 'full'));
  });
});
