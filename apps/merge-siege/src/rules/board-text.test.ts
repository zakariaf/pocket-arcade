// apps/merge-siege/src/rules/board-text.test.ts
// The board as readable text for the level goldens, the tests and the tutorial's fixed board.
import fc from 'fast-check';

import { CELL_COUNT } from './board-cells.ts';
import { boardText, parseBoard } from './board-text.ts';

import type { Cell } from './merge-siege-types.ts';

const ROWS = ['. . e2 . .', '. . . . .', 'e16 . . . .', '. . . . .', '. 4 . . .', '2 . . . 128'];

describe('parseBoard', () => {
  it('reads tiles, enemies and empty cells, numbering the pieces in reading order', () => {
    const cells = parseBoard(ROWS);
    expect(cells).toHaveLength(CELL_COUNT);
    expect(cells[2]).toStrictEqual({ id: 1, kind: 'enemy', value: 2 });
    expect(cells[10]).toStrictEqual({ id: 2, kind: 'enemy', value: 16 });
    expect(cells[21]).toStrictEqual({ id: 3, kind: 'tile', value: 4 });
    expect(cells[25]).toStrictEqual({ id: 4, kind: 'tile', value: 2 });
    expect(cells[29]).toStrictEqual({ id: 5, kind: 'tile', value: 128 });
    expect(cells.filter((cell) => cell === null)).toHaveLength(25);
  });

  it('throws a RangeError for a board of the wrong shape or an unknown cell', () => {
    expect(() => parseBoard(ROWS.slice(1))).toThrow(RangeError);
    expect(() => parseBoard([...ROWS.slice(1), '. . . .'])).toThrow(RangeError);
    expect(() => parseBoard([...ROWS.slice(1), '. . x . .'])).toThrow(RangeError);
  });
});

describe('boardText', () => {
  it('prints one line per row, top row first, with trailing spaces trimmed', () => {
    expect(boardText(parseBoard(ROWS))).toBe(GOLDEN_TEXT);
  });

  it('reads back to the same board (ids in reading order)', () => {
    const pieceArb = fc.option(
      fc.record({
        kind: fc.constantFrom('tile' as const, 'enemy' as const),
        power: fc.integer({ min: 1, max: 11 }),
      }),
      { nil: null },
    );
    fc.assert(
      fc.property(
        fc.array(pieceArb, { minLength: CELL_COUNT, maxLength: CELL_COUNT }),
        (pieces) => {
          let id = 0;
          const cells: Cell[] = pieces.map((piece) => {
            if (piece === null) return null;
            id += 1;
            let value = 1;
            for (let step = 0; step < piece.power; step += 1) value *= 2;
            return { id, kind: piece.kind, value };
          });
          expect(parseBoard(boardText(cells).split('\n'))).toStrictEqual(cells);
        },
      ),
    );
  });
});

const GOLDEN_TEXT = [
  '.   .   e2  .   .',
  '.   .   .   .   .',
  'e16 .   .   .   .',
  '.   .   .   .   .',
  '.   4   .   .   .',
  '2   .   .   .   128',
].join('\n');
