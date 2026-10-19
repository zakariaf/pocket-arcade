// apps/jump-chain/src/rules/board-squares.test.ts
import fc from 'fast-check';

import {
  DIAGONALS,
  SIDE_ROW,
  darkColumns,
  enemyAt,
  hasEnemyOnBoard,
  isDark,
  isOnBoard,
  isSameSquare,
} from './board-squares.ts';
import { TUNING } from './jump-chain-tuning.ts';

describe('isDark', () => {
  it('marks the squares whose column and row add up to an even number, above the board too', () => {
    expect([isDark(0, 0), isDark(1, 0), isDark(3, 7), isDark(2, 7), isDark(1, -1)]).toStrictEqual([
      true,
      false,
      true,
      false,
      true,
    ]);
  });

  it('keeps a square dark after a diagonal step or a march of two rows', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -20, max: 20 }),
        fc.integer({ min: -20, max: 20 }),
        (col, row) => {
          expect(isDark(col + 1, row - 1)).toBe(isDark(col, row));
          expect(isDark(col, row + TUNING.marchRows)).toBe(isDark(col, row));
        },
      ),
    );
  });
});

describe('darkColumns', () => {
  it('gives the enemy rows the three inner columns, never an edge column', () => {
    expect(darkColumns(5)).toStrictEqual(GOLDEN_ENEMY_COLUMNS);
    expect(darkColumns(-1)).toStrictEqual(GOLDEN_ENEMY_COLUMNS);
  });

  it('gives the rows between the ranks four columns, the edges included', () => {
    expect(darkColumns(4)).toStrictEqual([0, 2, 4, 6]);
  });
});

describe('isOnBoard', () => {
  it('accepts the 7 x 10 board and nothing around it', () => {
    const squares = [
      { col: 0, row: 0 },
      { col: 6, row: 9 },
      { col: -1, row: 4 },
      { col: 7, row: 4 },
      { col: 3, row: -1 },
      { col: 3, row: 10 },
    ];
    expect(squares.map((square) => isOnBoard(square))).toStrictEqual([
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe('the board lookups', () => {
  const enemies = [
    { id: 0, rank: 0, col: 1, row: 5 },
    { id: 1, rank: 1, col: 3, row: -1 },
  ];

  it('finds the enemy on a square and nothing on a free one', () => {
    expect(enemyAt(enemies, { col: 1, row: 5 })?.id).toBe(0);
    expect(enemyAt(enemies, { col: 3, row: 5 })).toBeUndefined();
  });

  it('tells an enemy on the board from ranks that only wait above it', () => {
    expect(hasEnemyOnBoard(enemies)).toBe(true);
    expect(hasEnemyOnBoard(enemies.slice(1))).toBe(false);
  });

  it('compares squares by column and row', () => {
    expect(isSameSquare({ col: 2, row: 4 }, { col: 2, row: 4 })).toBe(true);
    expect(isSameSquare({ col: 2, row: 4 }, { col: 4, row: 2 })).toBe(false);
  });

  it('lists the diagonals up-left, up-right, down-left, down-right and names your side row', () => {
    expect(DIAGONALS).toStrictEqual([
      { dc: -1, dr: -1 },
      { dc: 1, dr: -1 },
      { dc: -1, dr: 1 },
      { dc: 1, dr: 1 },
    ]);
    expect(SIDE_ROW).toBe(9);
  });
});

const GOLDEN_ENEMY_COLUMNS = [1, 3, 5];
