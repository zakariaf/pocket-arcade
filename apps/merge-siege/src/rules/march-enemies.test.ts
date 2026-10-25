// apps/merge-siege/src/rules/march-enemies.test.ts
// Spec 13: "numbered enemies march in". Every enemy steps one row down, the lowest first: into an
// empty cell; onto a tile, which smashes it when the tile's number is the same or bigger (design
// fix: ties go to the tile) and is crushed otherwise; behind another enemy it waits.
import { boardText, parseBoard } from './board-text.ts';
import { marchEnemies } from './march-enemies.ts';

const EMPTY_ROW = '. . . . .';
const textOf = (rows: readonly string[]): string => boardText(parseBoard(rows));

describe('marchEnemies', () => {
  it('steps every enemy one row down, the lowest first', () => {
    const { cells, steps } = marchEnemies(
      parseBoard(['e2 . e4 . .', EMPTY_ROW, '. e8 . . .', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW]),
    );
    expect(boardText(cells)).toBe(
      textOf([EMPTY_ROW, 'e2 . e4 . .', EMPTY_ROW, '. e8 . . .', EMPTY_ROW, EMPTY_ROW]),
    );
    expect(steps).toStrictEqual([
      { id: 3, from: 11, to: 16 },
      { id: 1, from: 0, to: 5 },
      { id: 2, from: 2, to: 7 },
    ]);
  });

  it('is smashed by a tile with the same number or a bigger one, scoring ten per number', () => {
    const { cells, smashes, points } = marchEnemies(
      parseBoard(['e4 e8 . . .', '4 16 . . .', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW]),
    );
    expect(boardText(cells)).toBe(
      textOf([EMPTY_ROW, '4 16 . . .', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW]),
    );
    expect(smashes).toStrictEqual([
      { id: 1, tileId: 3, cell: 5, value: 4 },
      { id: 2, tileId: 4, cell: 6, value: 8 },
    ]);
    expect(points).toBe(120);
  });

  it('crushes a smaller tile and moves into its cell', () => {
    const { cells, losses, steps } = marchEnemies(
      parseBoard(['e8 . . . .', '4 . . . .', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW]),
    );
    expect(boardText(cells)).toBe(
      textOf([EMPTY_ROW, 'e8 . . . .', EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW]),
    );
    expect(losses).toStrictEqual([{ id: 2, enemyId: 1, cell: 5, value: 4 }]);
    expect(steps).toStrictEqual([{ id: 1, from: 0, to: 5 }]);
  });

  it('keeps an enemy waiting behind an enemy that cannot step (the bottom row is never left)', () => {
    const rows = [EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, 'e2 . . . .', 'e4 . . . .'];
    const { cells, steps } = marchEnemies(parseBoard(rows));
    expect(boardText(cells)).toBe(textOf(rows));
    expect(steps).toStrictEqual([]);
  });

  it('keeps its input unchanged', () => {
    const input = parseBoard([
      'e2 . . . .',
      '2 . . . .',
      EMPTY_ROW,
      EMPTY_ROW,
      EMPTY_ROW,
      EMPTY_ROW,
    ]);
    const frozen = JSON.stringify(input);
    marchEnemies(input);
    expect(JSON.stringify(input)).toBe(frozen);
  });
});
