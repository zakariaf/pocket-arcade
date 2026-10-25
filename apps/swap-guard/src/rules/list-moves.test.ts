// apps/swap-guard/src/rules/list-moves.test.ts
import fc from 'fast-check';

import { create } from './create.ts';
import { listMoves } from './list-moves.ts';

import type { Enemy, SwapGuardState } from './swap-guard-types.ts';

/** A 5 x 5 board with the guard on `guard` and one spear on 24 facing the bottom edge. */
function board(guard: number, overrides: Partial<SwapGuardState> = {}): SwapGuardState {
  const spear: Enemy = { id: 0, kind: 'spear', facing: 'down', cell: 24 };
  return {
    size: 5,
    guard,
    enemies: [spear],
    enemyCount: 1,
    swaps: 0,
    maxSwaps: 12,
    score: 0,
    isHit: false,
    lastSwap: null,
    hasContinued: false,
    ...overrides,
  };
}

const cellsOf = (state: SwapGuardState): number[] => listMoves(state).map((move) => move.cell);

describe('listMoves (spec 13: "the only move is swapping places")', () => {
  it('offers the eight squares around the guard, diagonals included, in board order', () => {
    expect(cellsOf(board(12))).toStrictEqual(GOLDEN_MIDDLE_SWAPS);
  });

  it('offers only the squares on the board at a corner and an edge', () => {
    expect(cellsOf(board(0))).toStrictEqual([1, 5, 6]);
    expect(cellsOf(board(2))).toStrictEqual([1, 3, 6, 7, 8]);
  });

  it('offers a swap with an enemy next to the guard like any other square', () => {
    expect(listMoves(board(18))).toContainEqual({ kind: 'swap', cell: 24 });
  });

  it('offers nothing once the run is over', () => {
    expect(listMoves(board(12, { isHit: true }))).toStrictEqual([]);
    expect(listMoves(board(12, { enemies: [] }))).toStrictEqual([]);
    expect(listMoves(board(12, { swaps: 12 }))).toStrictEqual([]);
  });

  describe('properties', () => {
    it('lists each square once, and only squares one king step from the guard', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 4_294_967_295 }),
          fc.integer({ min: 0, max: 100 }),
          (seed, difficulty) => {
            const state = create(seed, difficulty);
            const cells = cellsOf(state);
            expect(cells.length).toBeGreaterThanOrEqual(3);
            expect(new Set(cells).size).toBe(cells.length);
            for (const cell of cells) {
              const rowGap = Math.abs(
                Math.floor(cell / state.size) - Math.floor(state.guard / state.size),
              );
              const colGap = Math.abs((cell % state.size) - (state.guard % state.size));
              expect(Math.max(rowGap, colGap)).toBe(1);
            }
          },
        ),
      );
    });
  });
});

const GOLDEN_MIDDLE_SWAPS = [6, 7, 8, 11, 13, 16, 17, 18];
