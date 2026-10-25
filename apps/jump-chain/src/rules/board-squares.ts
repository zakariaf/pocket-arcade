// apps/jump-chain/src/rules/board-squares.ts
// The board's geometry: dark squares, the four diagonals in listing order, and lookups. Like
// checkers, every piece stands on a dark square (column + row even), so a diagonal step or jump
// keeps it dark, and so does a march two rows straight down.
import { TUNING } from './jump-chain-tuning.ts';

import type { Enemy, Square } from './jump-chain-types.ts';

/** A diagonal direction: dc -1 is left, dr -1 is up (toward row 0). */
export type Diagonal = { readonly dc: -1 | 1; readonly dr: -1 | 1 };

/** The four diagonals in listing order: up-left, up-right, down-left, down-right. */
export const DIAGONALS: readonly Diagonal[] = [
  { dc: -1, dr: -1 },
  { dc: 1, dr: -1 },
  { dc: -1, dr: 1 },
  { dc: 1, dr: 1 },
];

/** The bottom row, your side: an enemy that reaches it overruns you. */
export const SIDE_ROW = TUNING.rows - 1;

/** Column + row even, bitwise so rows above the board (negative) work too. */
export function isDark(col: number, row: number): boolean {
  return ((col + row) & 1) === 0;
}

export function isOnBoard(square: Square): boolean {
  return square.col >= 0 && square.col < TUNING.cols && square.row >= 0 && square.row < TUNING.rows;
}

export function isSameSquare(a: Square, b: Square): boolean {
  return a.col === b.col && a.row === b.row;
}

/** The dark columns of a row, left to right: the squares a rank on that row can use. */
export function darkColumns(row: number): number[] {
  return Array.from({ length: TUNING.cols }, (_, col) => col).filter((col) => isDark(col, row));
}

/** The enemy on a square, if any. */
export function enemyAt(enemies: readonly Enemy[], square: Square): Enemy | undefined {
  return enemies.find((enemy) => enemy.col === square.col && enemy.row === square.row);
}

/** True when at least one enemy stands on the board (the others wait above it). */
export function hasEnemyOnBoard(enemies: readonly Enemy[]): boolean {
  return enemies.some((enemy) => enemy.row >= 0);
}
