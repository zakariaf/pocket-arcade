// apps/line-siege/src/rules/board-lines.ts
// Placement geometry and line clears on the square board (spec 13: "full rows and columns clear").
import { TUNING } from './line-siege-tuning.ts';

import type { Cell, Piece } from './line-siege-types.ts';

const SIZE = TUNING.boardSize;
const INDICES = Array.from({ length: SIZE }, (_, index) => index);

export type FullLines = { readonly rows: readonly number[]; readonly cols: readonly number[] };
export type Anchor = { readonly col: number; readonly row: number };

/** Board indices the piece would cover at the anchor, or null when it does not fit. */
export function coveredCells(
  cells: readonly Cell[],
  piece: Piece,
  anchor: Anchor,
): number[] | null {
  const indices: number[] = [];
  for (const [dx, dy] of piece) {
    const col = anchor.col + dx;
    const row = anchor.row + dy;
    const index = row * SIZE + col;
    const isInside = col >= 0 && col < SIZE && row >= 0 && row < SIZE;
    if (!isInside || cells[index] !== 0) return null;
    indices.push(index);
  }
  return indices;
}

export function isRowFull(cells: readonly Cell[], row: number): boolean {
  return INDICES.every((col) => cells[row * SIZE + col] === 1);
}

export function isColumnFull(cells: readonly Cell[], col: number): boolean {
  return INDICES.every((row) => cells[row * SIZE + col] === 1);
}

/** Every full row and column, in index order. */
export function fullLines(cells: readonly Cell[]): FullLines {
  return {
    rows: INDICES.filter((row) => isRowFull(cells, row)),
    cols: INDICES.filter((col) => isColumnFull(cells, col)),
  };
}

/** Empties every cell of the full rows and columns at once. */
export function clearLines(cells: readonly Cell[], lines: FullLines): Cell[] {
  return cells.map((cell, index) => {
    const isCleared =
      lines.rows.includes(Math.floor(index / SIZE)) || lines.cols.includes(index % SIZE);
    return isCleared ? 0 : cell;
  });
}
