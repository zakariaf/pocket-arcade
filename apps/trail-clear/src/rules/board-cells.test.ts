// apps/trail-clear/src/rules/board-cells.test.ts
import fc from 'fast-check';

import { ALL_CELLS, SIDES, cellAt, neighbourOf, oppositeOf } from './board-cells.ts';

const cellArb = fc.integer({ min: 0, max: 24 });
const sideArb = fc.constantFrom(...SIDES);

describe('neighbourOf (spec 13: a 5 x 5 board)', () => {
  it('finds the cells north, east, south and west of the middle cell', () => {
    expect(SIDES.map((side) => neighbourOf(12, side))).toStrictEqual([7, 13, 17, 11]);
  });

  it('gives -1 past the rim', () => {
    expect(SIDES.map((side) => neighbourOf(0, side))).toStrictEqual([-1, 1, 5, -1]);
    expect(SIDES.map((side) => neighbourOf(24, side))).toStrictEqual([19, -1, -1, 23]);
  });

  it('keeps a row end from wrapping round to the next row', () => {
    expect(neighbourOf(4, 1)).toBe(-1);
    expect(neighbourOf(5, 3)).toBe(-1);
  });

  it('comes back across the opposite side (property)', () => {
    fc.assert(
      fc.property(cellArb, sideArb, (cell, side) => {
        const next = neighbourOf(cell, side);
        fc.pre(next >= 0);
        expect(neighbourOf(next, oppositeOf(side))).toBe(cell);
      }),
    );
  });
});

describe('cellAt', () => {
  it('numbers the cells row by row', () => {
    expect([cellAt(0, 0), cellAt(4, 0), cellAt(0, 1), cellAt(3, 4)]).toStrictEqual([0, 4, 5, 23]);
  });

  it('gives -1 off the board and for a part cell', () => {
    expect([cellAt(-1, 0), cellAt(5, 0), cellAt(0, 5), cellAt(1.5, 2)]).toStrictEqual([
      -1, -1, -1, -1,
    ]);
  });

  it('lists all 25 cells in board order', () => {
    expect(ALL_CELLS).toStrictEqual(Array.from({ length: 25 }, (_, cell) => cell));
  });
});
