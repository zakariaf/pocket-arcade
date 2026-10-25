// apps/merge-siege/src/rules/board-text.ts
// The board as readable text, one line per row, top row first: '.' an empty cell, a number a tile
// ('8'), 'e' and a number an enemy ('e16'). The level goldens print boards with boardText; the
// tutorial and the tests build fixed boards with parseBoard (ids 1, 2, ... in reading order).
import { COLS, ROWS } from './board-cells.ts';

import type { Cell } from './merge-siege-types.ts';

/** Tokens are padded to this width and joined by one space, so columns line up up to 'e16'. */
const TOKEN_WIDTH = 3;
const TOKEN = /^(e?)(\d+)$/;

function cellText(cell: Cell): string {
  if (cell === null) return '.';
  return cell.kind === 'enemy' ? `e${String(cell.value)}` : String(cell.value);
}

/** The board as text, trailing spaces trimmed. */
export function boardText(cells: readonly Cell[]): string {
  const lines: string[] = [];
  for (let row = 0; row < ROWS; row += 1) {
    const tokens = cells
      .slice(row * COLS, (row + 1) * COLS)
      .map((cell) => cellText(cell).padEnd(TOKEN_WIDTH));
    lines.push(tokens.join(' ').trimEnd());
  }
  return lines.join('\n');
}

/** One row of cells; the id counter advances for every piece. */
function parseRow(row: string, firstId: number): Cell[] {
  const tokens = row.trim().split(/\s+/);
  if (tokens.length !== COLS) throw new RangeError(`a row has ${String(COLS)} cells, got "${row}"`);
  let id = firstId;
  return tokens.map((token): Cell => {
    if (token === '.') return null;
    const match = TOKEN.exec(token);
    if (match === null) throw new RangeError(`unknown cell "${token}"`);
    const piece: Cell = { id, kind: match[1] === 'e' ? 'enemy' : 'tile', value: Number(match[2]) };
    id += 1;
    return piece;
  });
}

/**
 * Builds cells from text rows (tokens separated by spaces). Throws a RangeError for a wrong shape
 * or an unknown token, so a mistyped fixed board fails loudly.
 */
export function parseBoard(rows: readonly string[]): Cell[] {
  if (rows.length !== ROWS)
    throw new RangeError(`a board has ${String(ROWS)} rows, got ${String(rows.length)}`);
  const cells: Cell[] = [];
  for (const row of rows)
    cells.push(...parseRow(row, cells.filter((cell) => cell !== null).length + 1));
  return cells;
}
