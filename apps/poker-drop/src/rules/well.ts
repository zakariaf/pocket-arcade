// apps/poker-drop/src/rules/well.ts
// The well's geometry: cells are row-major with row 0 at the bottom; a line is any five cells in a
// straight run (each row, five of a column, the long diagonals); gravity packs every column down.
import { TUNING } from './poker-drop-tuning.ts';

import type { Cell, LineKind } from './poker-drop-types.ts';

export const COLS = TUNING.wellCols;
export const ROWS = TUNING.wellRows;
const LENGTH = TUNING.lineLength;

/** The cell index of a column and a row (row 0 at the bottom). */
export function cellIndex(col: number, row: number): number {
  return row * COLS + col;
}

/** A line: its kind and its five cells, from the bottom (or the start) up. */
export type WellLine = { readonly kind: LineKind; readonly cells: readonly number[] };

function lineFrom(
  kind: LineKind,
  start: readonly [number, number],
  step: readonly [number, number],
): WellLine {
  const cells = Array.from({ length: LENGTH }, (_, i) =>
    cellIndex(start[0] + i * step[0], start[1] + i * step[1]),
  );
  return { kind, cells };
}

function buildLines(): WellLine[] {
  const lines: WellLine[] = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col + LENGTH <= COLS; col += 1)
      lines.push(lineFrom('row', [col, row], [1, 0]));
  }
  for (let col = 0; col < COLS; col += 1) {
    for (let row = 0; row + LENGTH <= ROWS; row += 1)
      lines.push(lineFrom('column', [col, row], [0, 1]));
  }
  for (let row = 0; row + LENGTH <= ROWS; row += 1) {
    for (let col = 0; col + LENGTH <= COLS; col += 1) {
      lines.push(lineFrom('diagonal', [col, row], [1, 1]));
      lines.push(lineFrom('diagonal', [col + LENGTH - 1, row], [-1, 1]));
    }
  }
  return lines;
}

/** Every line of the well in a fixed order: rows, then columns, then diagonals. */
export const WELL_LINES: readonly WellLine[] = buildLines();

/** An empty well. */
export function emptyWell(): Cell[] {
  return Array.from({ length: COLS * ROWS }, (): Cell => null);
}

/** How many cards a column holds (its lowest empty row). */
export function heightOf(cells: readonly Cell[], col: number): number {
  let height = 0;
  while (height < ROWS && cells[cellIndex(col, height)] !== null) height += 1;
  return height;
}

/** True when the column has room for one more card. */
export function hasRoom(cells: readonly Cell[], col: number): boolean {
  return heightOf(cells, col) < ROWS;
}

/** A card moved by gravity: its column, the row it left and the row it landed on. */
export type Settled = { readonly col: number; readonly fromRow: number; readonly toRow: number };

/** Packs every column down (cards keep their order); returns the new cells and every card that moved. */
export function settle(cells: readonly Cell[]): {
  readonly cells: Cell[];
  readonly moves: Settled[];
} {
  const out = emptyWell();
  const moves: Settled[] = [];
  for (let col = 0; col < COLS; col += 1) {
    let toRow = 0;
    for (let fromRow = 0; fromRow < ROWS; fromRow += 1) {
      const card = cells[cellIndex(col, fromRow)] as Cell;
      if (card === null) continue;
      out[cellIndex(col, toRow)] = card;
      if (toRow !== fromRow) moves.push({ col, fromRow, toRow });
      toRow += 1;
    }
  }
  return { cells: out, moves };
}
