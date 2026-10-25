// apps/trail-clear/src/rules/board-cells.ts
// Board geometry: cells are row-major indices; sides are 0 north, 1 east, 2 south, 3 west.
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';

import { TUNING } from './trail-clear-tuning.ts';

const SIZE = TUNING.boardSize;
const STEP_COL = [0, 1, 0, -1] as const;
const STEP_ROW = [-1, 0, 1, 0] as const;

/** The four sides in board order. */
export const SIDES = [0, 1, 2, 3] as const;

/** The side across from `side` (north <-> south, east <-> west). */
export function oppositeOf(side: number): number {
  return (side + 2) % 4;
}

/** The cell next to `cell` on `side`, or -1 past the rim. */
export function neighbourOf(cell: number, side: number): number {
  const col = (cell % SIZE) + pickAt(STEP_COL, side);
  const row = Math.floor(cell / SIZE) + pickAt(STEP_ROW, side);
  if (col < 0 || col >= SIZE || row < 0 || row >= SIZE) return -1;
  return row * SIZE + col;
}

/** The cell index of (col, row), or -1 off the board or for a non-whole value. */
export function cellAt(col: number, row: number): number {
  const isInside = Number.isInteger(col) && Number.isInteger(row) && col >= 0 && row >= 0;
  return isInside && col < SIZE && row < SIZE ? row * SIZE + col : -1;
}

/** Every cell index, in board order. */
export const ALL_CELLS: readonly number[] = Array.from({ length: SIZE * SIZE }, (_, cell) => cell);
