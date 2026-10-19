// apps/poker-drop/src/rules/list-moves.test.ts
import fc from 'fast-check';

import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';
import { COLS, ROWS, cellIndex } from './well.ts';

import type { PokerDropState } from './poker-drop-types.ts';

const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 100 });

/** The state with column `col` filled to the top. */
function fillColumn(state: PokerDropState, col: number): PokerDropState {
  const cells = [...state.cells];
  for (let row = 0; row < ROWS; row += 1) cells[cellIndex(col, row)] = row;
  return { ...state, cells };
}

/** The columns of the listed moves. */
function listedCols(state: PokerDropState): number[] {
  return listMoves(state).map((move) => move.col);
}

describe('listMoves', () => {
  it('drops into every column with room, left to right', () => {
    expect(listMoves(create(1, 0))).toStrictEqual(
      [0, 1, 2, 3, 4].map((col) => ({ kind: 'drop-card', col })),
    );
  });

  it('leaves out a full column', () => {
    const state = fillColumn(create(1, 0), 2);
    expect(listMoves(state).map((move) => move.col)).toStrictEqual([0, 1, 3, 4]);
  });

  it('lists nothing once the run is over (won, or the well is full)', () => {
    const start = create(1, 0);
    expect(listMoves({ ...start, handsMade: start.goal })).toStrictEqual([]);
    const full = [0, 1, 2, 3, 4].reduce(fillColumn, start);
    expect(listMoves(full)).toStrictEqual([]);
  });

  describe('properties', () => {
    it('lists no move twice, each a column of the well, and none exactly when the run is over', () => {
      fc.assert(
        fc.property(
          seedArb,
          difficultyArb,
          fc.subarray([0, 1, 2, 3, 4]),
          (seed, difficulty, full) => {
            const state = full.reduce(fillColumn, create(seed, difficulty));
            const cols = listedCols(state);
            expect(new Set(cols).size).toBe(cols.length);
            expect(Math.min(COLS, ...cols)).toBeGreaterThanOrEqual(0);
            expect(Math.max(-1, ...cols)).toBeLessThan(COLS);
            expect(cols.length === 0).toBe(outcome(state).kind !== 'playing');
          },
        ),
      );
    });
  });
});
