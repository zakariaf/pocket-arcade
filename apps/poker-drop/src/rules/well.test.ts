// apps/poker-drop/src/rules/well.test.ts
import fc from 'fast-check';

import {
  COLS,
  ROWS,
  WELL_LINES,
  cardIn,
  cellIndex,
  emptyWell,
  hasRoom,
  heightOf,
  isCard,
  settle,
} from './well.ts';

import type { Cell } from './poker-drop-types.ts';

/** A well from rows of text, top row first: digits are cards, '.' is empty. */
function wellOf(rowsTopFirst: readonly string[]): Cell[] {
  const cells = emptyWell();
  [...rowsTopFirst].reverse().forEach((text, row) => {
    text.split('').forEach((char, col) => {
      cells[cellIndex(col, row)] = char === '.' ? null : Number(char);
    });
  });
  return cells;
}

const cellArb = fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 51 }));
const wellArb = fc.array(cellArb, { minLength: COLS * ROWS, maxLength: COLS * ROWS });

describe('WELL_LINES', () => {
  // spec 13: "poker hands in any line burst"; a line is five cards across, up or diagonal.
  it('lists the 6 rows, 10 column runs and 4 long diagonals of the 5 x 6 well', () => {
    const kinds = WELL_LINES.map((line) => line.kind);
    expect(kinds.filter((kind) => kind === 'row')).toHaveLength(6);
    expect(kinds.filter((kind) => kind === 'column')).toHaveLength(10);
    expect(kinds.filter((kind) => kind === 'diagonal')).toHaveLength(4);
  });

  it('gives every line five different cells inside the well', () => {
    for (const line of WELL_LINES) {
      expect(new Set(line.cells).size).toBe(5);
      expect(line.cells.every((cell) => cell >= 0 && cell < COLS * ROWS)).toBe(true);
    }
  });

  it('runs the diagonals corner to corner, up-right and up-left', () => {
    const diagonals = WELL_LINES.filter((line) => line.kind === 'diagonal').map(
      (line) => line.cells,
    );
    expect(diagonals).toStrictEqual([
      [0, 6, 12, 18, 24],
      [4, 8, 12, 16, 20],
      [5, 11, 17, 23, 29],
      [9, 13, 17, 21, 25],
    ]);
  });
});

describe('heightOf and hasRoom', () => {
  it('counts the cards of a column and says when it is full', () => {
    const cells = wellOf(['1....', '1....', '1....', '1....', '11...', '111..']);
    expect([0, 1, 2, 3, 4].map((col) => heightOf(cells, col))).toStrictEqual([6, 2, 1, 0, 0]);
    expect(hasRoom(cells, 0)).toBe(false);
    expect(hasRoom(cells, 1)).toBe(true);
  });
});

describe('isCard and cardIn', () => {
  it('reads the card of a filled cell and refuses an empty or missing one', () => {
    const cells = wellOf(['.....', '.....', '.....', '.....', '.....', '7....']);
    expect(isCard(cells[0])).toBe(true);
    expect(isCard(cells[1])).toBe(false);
    expect(cardIn(cells, 0)).toBe(7);
    expect(() => cardIn(cells, 1)).toThrow(RangeError);
    expect(() => cardIn(cells, 99)).toThrow(RangeError);
  });
});

describe('settle', () => {
  it('drops every card to the lowest empty cell of its column, keeping their order', () => {
    const before = wellOf(['.....', '2....', '.....', '1.3..', '.....', '....4']);
    const { cells, moves } = settle(before);
    expect(cells).toStrictEqual(wellOf(['.....', '.....', '.....', '.....', '2....', '1.3.4']));
    expect(moves).toStrictEqual([
      { col: 0, fromRow: 2, toRow: 0 },
      { col: 0, fromRow: 4, toRow: 1 },
      { col: 2, fromRow: 2, toRow: 0 },
    ]);
  });

  it('keeps every card, leaves no gap under a card and never changes its input', () => {
    fc.assert(
      fc.property(wellArb, (cells) => {
        const copy = [...cells];
        const settled = settle(cells).cells;
        expect(cells).toStrictEqual(copy);
        const cards = (list: readonly Cell[]): number[] =>
          list.filter((card): card is number => card !== null).sort((a, b) => a - b);
        expect(cards(settled)).toStrictEqual(cards(cells));
        for (let col = 0; col < COLS; col += 1) {
          const height = heightOf(settled, col);
          for (let row = height; row < ROWS; row += 1)
            expect(settled[cellIndex(col, row)]).toBeNull();
        }
      }),
    );
  });
});
