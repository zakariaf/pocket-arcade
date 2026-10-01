// apps/line-siege/src/rules/board-lines.test.ts
import fc from 'fast-check';

import { clearLines, coveredCells, fullLines } from './board-lines.ts';

import type { Cell } from './line-siege-types.ts';

const SIZE = 8;

/** An 8x8 board with exactly these cells filled. */
function boardWith(filled: readonly number[]): Cell[] {
  return Array.from({ length: SIZE * SIZE }, (_, index): Cell => (filled.includes(index) ? 1 : 0));
}

const row = (r: number): number[] => Array.from({ length: SIZE }, (_, c) => r * SIZE + c);
const column = (c: number): number[] => Array.from({ length: SIZE }, (_, r) => r * SIZE + c);

describe('coveredCells', () => {
  it('lists the board indices a piece covers at its anchor', () => {
    const lShape = [
      [0, 0],
      [0, 1],
      [1, 1],
    ] as const;
    expect(coveredCells(boardWith([]), lShape, { col: 6, row: 2 })).toStrictEqual([22, 30, 31]);
  });

  it('returns null when a cell is outside the board or already filled', () => {
    const bar = [
      [0, 0],
      [1, 0],
    ] as const;
    expect(coveredCells(boardWith([]), bar, { col: 7, row: 0 })).toBeNull();
    expect(coveredCells(boardWith([1]), bar, { col: 0, row: 0 })).toBeNull();
    expect(coveredCells(boardWith([]), bar, { col: -1, row: 0 })).toBeNull();
    expect(coveredCells(boardWith([]), [[0, 0]], { col: 0, row: 8 })).toBeNull();
  });
});

describe('fullLines', () => {
  it('finds every full row and full column (spec 13: full rows and columns clear)', () => {
    const cells = boardWith([...row(2), ...column(5), ...row(7)]);
    expect(fullLines(cells)).toStrictEqual({ rows: [2, 7], cols: [5] });
  });

  it('finds nothing on a board with a gap in every line', () => {
    expect(fullLines(boardWith(row(3).slice(1)))).toStrictEqual({ rows: [], cols: [] });
  });
});

describe('clearLines', () => {
  it('empties the cells of every full row and column at once (a crossing cell counts once)', () => {
    const cells = boardWith([...row(0), ...column(0), 9]);
    const cleared = clearLines(cells, fullLines(cells));
    expect(cleared.filter((cell) => cell === 1)).toHaveLength(1);
    expect(cleared[9]).toBe(1);
  });

  it('leaves a board without full lines as it is', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 63 }), { maxLength: 20 }), (filled) => {
        const cells = boardWith(filled);
        const lines = fullLines(cells);
        fc.pre(lines.rows.length === 0 && lines.cols.length === 0);
        expect(clearLines(cells, lines)).toStrictEqual(cells);
      }),
    );
  });
});

describe('board text golden', () => {
  it('keeps the pinned result of clearing a crossing row and column', () => {
    const cells = boardWith([...row(4), ...column(3), 0, 63]);
    const text = clearLines(cells, fullLines(cells)).join('');
    expect(text).toBe(GOLDEN_CROSS_CLEARED);
  });
});

const GOLDEN_CROSS_CLEARED = '1'.padEnd(63, '0') + '1';
