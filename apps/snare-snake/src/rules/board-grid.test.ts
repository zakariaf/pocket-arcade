// apps/snare-snake/src/rules/board-grid.test.ts
import fc from 'fast-check';

import { DIRECTIONS, neighboursOf, stepFrom, touchingCells } from './board-grid.ts';

const GRID = { cols: 7, rows: 8 };

describe('stepFrom', () => {
  it('steps one cell in each physical direction', () => {
    expect(DIRECTIONS.map((direction) => stepFrom(GRID, 24, direction))).toStrictEqual([
      17, 25, 31, 23,
    ]);
  });

  it('returns null off every edge of the board', () => {
    expect(stepFrom(GRID, 0, 'up')).toBeNull();
    expect(stepFrom(GRID, 0, 'left')).toBeNull();
    expect(stepFrom(GRID, 6, 'right')).toBeNull();
    expect(stepFrom(GRID, 55, 'down')).toBeNull();
  });

  it('keeps every step inside its row and column (no wrap onto the next row)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 55 }),
        fc.constantFrom(...DIRECTIONS),
        (cell, direction) => {
          const next = stepFrom(GRID, cell, direction);
          if (next === null) return;
          const distance =
            Math.abs((next % 7) - (cell % 7)) +
            Math.abs(Math.floor(next / 7) - Math.floor(cell / 7));
          expect(distance).toBe(1);
        },
      ),
    );
  });
});

describe('neighboursOf', () => {
  it('lists the side neighbours in direction order, two in a corner', () => {
    expect(neighboursOf(GRID, 8)).toStrictEqual([1, 9, 15, 7]);
    expect(neighboursOf(GRID, 0)).toStrictEqual([1, 7]);
  });
});

describe('touchingCells', () => {
  it('collects every cell sharing a side with the given cells', () => {
    expect([...touchingCells(GRID, [0, 1])].sort((a, b) => a - b)).toStrictEqual([0, 1, 2, 7, 8]);
  });
});
