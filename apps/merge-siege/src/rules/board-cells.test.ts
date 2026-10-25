// apps/merge-siege/src/rules/board-cells.test.ts
// The 5 x 6 board of spec 13's Merge Siege: row 0 at the top, where the enemies enter.
import {
  CELL_COUNT,
  DIRECTIONS,
  cellAt,
  emptyCells,
  neighbourOf,
  slideOrder,
} from './board-cells.ts';

describe('board cells', () => {
  it('numbers the cells row by row, 30 of them, from the top start corner', () => {
    expect(CELL_COUNT).toBe(30);
    expect(cellAt(0, 0)).toBe(0);
    expect(cellAt(4, 0)).toBe(4);
    expect(cellAt(0, 1)).toBe(5);
    expect(cellAt(4, 5)).toBe(29);
  });

  it('offers the swipes in the fixed order up, down, left, right', () => {
    expect(DIRECTIONS).toStrictEqual(['up', 'down', 'left', 'right']);
  });

  it('finds the neighbour one step away, or null past an edge', () => {
    expect(neighbourOf(7, [0, -1])).toBe(2);
    expect(neighbourOf(7, [1, 0])).toBe(8);
    expect(neighbourOf(2, [0, -1])).toBeNull();
    expect(neighbourOf(4, [1, 0])).toBeNull();
    expect(neighbourOf(25, [-1, 0])).toBeNull();
    expect(neighbourOf(27, [0, 1])).toBeNull();
  });

  it('walks the cells nearest the wall a swipe pushes toward first (2048 order)', () => {
    expect(slideOrder('up').slice(0, 6)).toStrictEqual([0, 1, 2, 3, 4, 5]);
    expect(slideOrder('down').slice(0, 6)).toStrictEqual([25, 26, 27, 28, 29, 20]);
    expect(slideOrder('left').slice(0, 6)).toStrictEqual([0, 1, 2, 3, 4, 5]);
    expect(slideOrder('right').slice(0, 6)).toStrictEqual([4, 3, 2, 1, 0, 9]);
  });

  it('visits every cell exactly once in every slide order', () => {
    for (const direction of DIRECTIONS) {
      expect([...slideOrder(direction)].sort((a, b) => a - b)).toStrictEqual(
        Array.from({ length: CELL_COUNT }, (_, cell) => cell),
      );
    }
  });

  it('lists the empty cells in board order', () => {
    const cells = Array.from({ length: CELL_COUNT }, (_, cell) =>
      cell % 7 === 0 ? null : { id: cell + 1, kind: 'tile' as const, value: 2 },
    );
    expect(emptyCells(cells)).toStrictEqual([0, 7, 14, 21, 28]);
  });
});
