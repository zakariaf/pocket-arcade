// apps/snare-snake/src/rules/snare-loop.test.ts
import fc from 'fast-check';

import { enclosedBy, snaredBy } from './snare-loop.ts';

const GRID = { cols: 7, rows: 8 };
const at = (col: number, row: number): number => row * 7 + col;
/** The eight cells around (2, 2): the smallest loop with a cell inside. */
const RING = [at(1, 1), at(2, 1), at(3, 1), at(3, 2), at(3, 3), at(2, 3), at(1, 3), at(1, 2)];

describe('enclosedBy', () => {
  it('finds the one cell inside an eight-cell ring', () => {
    expect(enclosedBy(GRID, RING)).toStrictEqual([at(2, 2)]);
  });

  it('finds nothing inside a 2 x 2 curl or an open chain', () => {
    expect(enclosedBy(GRID, [at(1, 1), at(2, 1), at(2, 2), at(1, 2)])).toStrictEqual([]);
    expect(enclosedBy(GRID, RING.slice(0, 7))).toStrictEqual([]);
  });

  it('counts the board edge as outside: a ring along the edge still needs all its sides', () => {
    const corner = [at(0, 0), at(1, 0), at(2, 0), at(2, 1), at(2, 2), at(1, 2), at(0, 2), at(0, 1)];
    expect(enclosedBy(GRID, corner)).toStrictEqual([at(1, 1)]);
    expect(enclosedBy(GRID, [at(1, 0), at(1, 1), at(0, 1)])).toStrictEqual([]);
  });

  it('finds every cell inside a bigger loop', () => {
    const loop = [
      at(0, 0),
      at(1, 0),
      at(2, 0),
      at(3, 0),
      at(3, 1),
      at(3, 2),
      at(2, 2),
      at(1, 2),
      at(0, 2),
      at(0, 1),
    ];
    expect(enclosedBy(GRID, loop)).toStrictEqual([at(1, 1), at(2, 1)]);
  });

  it('keeps every loop cell out of the inside (property)', () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.integer({ min: 0, max: 55 }), { maxLength: 30 }), (cells) => {
        const inside = enclosedBy(GRID, cells);
        for (const cell of inside) expect(cells).not.toContain(cell);
      }),
    );
  });
});

describe('snaredBy (the design fix: inside the loop or touching it)', () => {
  it('snares the cells inside and the cells sharing a side with the loop', () => {
    const snared = snaredBy(GRID, RING, [at(2, 2)]);
    expect(snared.has(at(2, 2))).toBe(true);
    expect(snared.has(at(4, 2))).toBe(true);
    expect(snared.has(at(2, 0))).toBe(true);
    expect(snared.has(at(4, 4))).toBe(false);
    expect(snared.has(at(5, 2))).toBe(false);
  });
});
