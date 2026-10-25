// apps/swap-guard/src/rules/board-grid.test.ts
import fc from 'fast-check';

import { FACINGS, oppositeOf, squaresAround, stepFrom } from './board-grid.ts';

describe('stepFrom (physical directions: the board never mirrors, spec 7.5)', () => {
  it('steps one square in each facing on a 5 x 5 board', () => {
    expect(FACINGS.map((facing) => stepFrom(5, 12, facing))).toStrictEqual([7, 13, 17, 11]);
  });

  it('gives null past every edge', () => {
    expect(stepFrom(5, 2, 'up')).toBeNull();
    expect(stepFrom(5, 9, 'right')).toBeNull();
    expect(stepFrom(5, 22, 'down')).toBeNull();
    expect(stepFrom(5, 10, 'left')).toBeNull();
  });
});

describe('oppositeOf', () => {
  it('turns each facing around', () => {
    expect(FACINGS.map(oppositeOf)).toStrictEqual(['down', 'left', 'up', 'right']);
  });
});

describe('squaresAround', () => {
  it('gives the eight squares around a middle square in board order', () => {
    expect(squaresAround(5, 12)).toStrictEqual(GOLDEN_AROUND_MIDDLE);
  });

  it('keeps only the squares on the board at a corner and an edge', () => {
    expect(squaresAround(5, 0)).toStrictEqual([1, 5, 6]);
    expect(squaresAround(6, 35)).toStrictEqual([28, 29, 34]);
    expect(squaresAround(5, 2)).toStrictEqual([1, 3, 6, 7, 8]);
  });

  it('gives only neighbours one king step away, never the square itself', () => {
    fc.assert(
      fc.property(fc.integer({ min: 5, max: 6 }), fc.nat(), (size, pick) => {
        const cell = pick % (size * size);
        for (const near of squaresAround(size, cell)) {
          const rowGap = Math.abs(Math.floor(near / size) - Math.floor(cell / size));
          const colGap = Math.abs((near % size) - (cell % size));
          expect(Math.max(rowGap, colGap)).toBe(1);
        }
      }),
    );
  });
});

const GOLDEN_AROUND_MIDDLE = [6, 7, 8, 11, 13, 16, 17, 18];
