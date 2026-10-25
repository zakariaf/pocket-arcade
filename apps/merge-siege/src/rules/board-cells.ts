// apps/merge-siege/src/rules/board-cells.ts
// Cell arithmetic of the 5 x 6 board (row-major, row 0 at the top where the enemies enter) and
// the physical step of each swipe direction (7.5: a board is a physical space, never mirrored).
import { TUNING } from './merge-siege-tuning.ts';

import type { Cell } from './merge-siege-types.ts';
import type { SwipeDirection } from '@e07/game-kit/geom/classify-swipe.ts';

export const COLS = TUNING.cols;
export const ROWS = TUNING.rows;
export const CELL_COUNT = COLS * ROWS;

/** The four swipes in the fixed order listMoves offers them (bots and replays rely on it). */
export const DIRECTIONS: readonly SwipeDirection[] = ['up', 'down', 'left', 'right'];

/** One cell step per direction: [dx, dy]. */
export const STEP: Readonly<Record<SwipeDirection, readonly [number, number]>> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

/** The index of the cell in this column and row. */
export const cellAt = (col: number, row: number): number => row * COLS + col;

/** The cell one step away, or null past an edge of the board. */
export function neighbourOf(cell: number, step: readonly [number, number]): number | null {
  const col = (cell % COLS) + step[0];
  const row = Math.floor(cell / COLS) + step[1];
  const isInside = col >= 0 && row >= 0 && col < COLS && row < ROWS;
  return isInside ? cellAt(col, row) : null;
}

/** Every cell, nearest the wall the swipe pushes toward first (2048's order). */
export function slideOrder(direction: SwipeDirection): readonly number[] {
  const [dx, dy] = STEP[direction];
  const cols = Array.from({ length: COLS }, (_, col) => col);
  const rows = Array.from({ length: ROWS }, (_, row) => row);
  if (dx > 0) cols.reverse();
  if (dy > 0) rows.reverse();
  return rows.flatMap((row) => cols.map((col) => cellAt(col, row)));
}

/** The cells holding no piece, in board order. */
export function emptyCells(cells: readonly Cell[]): number[] {
  return cells.flatMap((cell, index) => (cell === null ? [index] : []));
}
