// apps/swap-guard/src/rules/strikes.test.ts
import fc from 'fast-check';

import { create } from './create.ts';
import { strikesOf, struckSquares } from './strikes.ts';

import type { Enemy, EnemyKind, Facing, SwapGuardState } from './swap-guard-types.ts';

type Piece = readonly [kind: EnemyKind, facing: Facing, cell: number];

/** A 5 x 5 board (squares 0..24, row-major) with the guard and these enemies (ids in order). */
function board(guard: number, pieces: readonly Piece[]): SwapGuardState {
  const enemies: Enemy[] = pieces.map(([kind, facing, cell], id) => ({ id, kind, facing, cell }));
  return {
    size: 5,
    guard,
    enemies,
    enemyCount: enemies.length,
    swaps: 0,
    maxSwaps: 12,
    score: 0,
    isHit: false,
    lastSwap: null,
    hasContinued: false,
  };
}

/** The squares struck that lie off the board or under their own striker. */
function strayStrikes(state: SwapGuardState): number[] {
  return strikesOf(state).flatMap((strike, index) =>
    strike.cells.filter(
      (cell) => cell < 0 || cell >= state.size * state.size || cell === state.enemies[index]?.cell,
    ),
  );
}

describe('strikesOf (spec 13: "Every enemy shows where it will strike")', () => {
  it('gives a spear the one square in front of it', () => {
    expect(strikesOf(board(0, [['spear', 'down', 7]]))).toStrictEqual([
      { enemyId: 0, cells: [12] },
    ]);
  });

  it('gives a spear facing the edge no square', () => {
    expect(strikesOf(board(12, [['spear', 'up', 2]]))).toStrictEqual([{ enemyId: 0, cells: [] }]);
  });

  it('flies an arrow up to and including the first piece in its way', () => {
    const state = board(0, [
      ['archer', 'right', 10],
      ['spear', 'up', 13],
    ]);
    expect(strikesOf(state)[0]).toStrictEqual(GOLDEN_ARROW_TO_BLOCKER);
  });

  it('flies an arrow to the edge when nothing is in its way', () => {
    const state = board(24, [['archer', 'left', 14]]);
    expect(strikesOf(state)[0]?.cells).toStrictEqual([13, 12, 11, 10]);
  });

  it('stops an arrow at the guard', () => {
    const state = board(7, [['archer', 'up', 22]]);
    expect(strikesOf(state)[0]?.cells).toStrictEqual([17, 12, 7]);
  });

  it('gives a brute the four squares beside it, cut at the edge', () => {
    expect(strikesOf(board(24, [['brute', 'up', 12]]))[0]?.cells).toStrictEqual([7, 13, 17, 11]);
    expect(strikesOf(board(24, [['brute', 'up', 0]]))[0]?.cells).toStrictEqual([1, 5]);
  });

  it('lists the strikes in enemy order (the one resolution order)', () => {
    const state = board(24, [
      ['spear', 'right', 0],
      ['spear', 'left', 4],
    ]);
    expect(strikesOf(state).map((strike) => strike.enemyId)).toStrictEqual([0, 1]);
  });

  describe('struckSquares', () => {
    it('joins every strike once', () => {
      const state = board(24, [
        ['spear', 'right', 0],
        ['spear', 'left', 2],
      ]);
      expect([...struckSquares(strikesOf(state))]).toStrictEqual([1]);
    });
  });

  describe('properties', () => {
    it('strikes only squares on the board, never the striker own square', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 4_294_967_295 }),
          fc.integer({ min: 0, max: 99 }),
          (seed, difficulty) => {
            const state = create(seed, difficulty);
            expect(strikesOf(state)).toHaveLength(state.enemies.length);
            expect(strayStrikes(state)).toStrictEqual([]);
          },
        ),
      );
    });
  });
});

const GOLDEN_ARROW_TO_BLOCKER = { enemyId: 0, cells: [11, 12, 13] };
