// apps/snare-snake/src/rules/board-grid.ts
// The board's cells: index = row * cols + col. Directions are physical, in the fixed order up,
// right, down, left (the board never mirrors in fa and ckb, spec 7.5).
import type { Direction } from './snare-snake-types.ts';

export type Grid = { readonly cols: number; readonly rows: number };

export const DIRECTIONS: readonly Direction[] = ['up', 'right', 'down', 'left'];

const OFFSETS: Readonly<Record<Direction, readonly [number, number]>> = {
  up: [0, -1],
  right: [1, 0],
  down: [0, 1],
  left: [-1, 0],
};

/** The cell one step from `cell` in `direction`, or null when that is off the board. */
export function stepFrom(grid: Grid, cell: number, direction: Direction): number | null {
  const [deltaCol, deltaRow] = OFFSETS[direction];
  const col = (cell % grid.cols) + deltaCol;
  const row = Math.floor(cell / grid.cols) + deltaRow;
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return null;
  return row * grid.cols + col;
}

/** The cells sharing a side with `cell`, in DIRECTIONS order. */
export function neighboursOf(grid: Grid, cell: number): number[] {
  return DIRECTIONS.map((direction) => stepFrom(grid, cell, direction)).filter(
    (next): next is number => next !== null,
  );
}

/** Every cell sharing a side with at least one of `cells`. */
export function touchingCells(grid: Grid, cells: readonly number[]): Set<number> {
  return new Set(cells.flatMap((cell) => neighboursOf(grid, cell)));
}
