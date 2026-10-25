// apps/scrap-shove/src/rules/floor-squares.ts
// Square arithmetic of the floor: king steps (across, along or diagonal), distances, and which
// piece stands on a square. Pure integer maths only.
import type { Cell, Floor, Heap, Robot } from './scrap-shove-types.ts';

/** -1, 0 or 1: the direction of a whole number. */
export function signOf(value: number): number {
  if (value > 0) return 1;
  return value < 0 ? -1 : 0;
}

/** Squares a king needs from a to b (Chebyshev distance): robots close one per step. */
export function distanceBetween(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row));
}

export function isSameCell(a: Cell, b: Cell): boolean {
  return a.col === b.col && a.row === b.row;
}

/** The square one king step from `from` toward `to` (from itself when they are the same). */
export function stepToward(from: Cell, to: Cell): Cell {
  return { col: from.col + signOf(to.col - from.col), row: from.row + signOf(to.row - from.row) };
}

/** The square one step beyond `to`, continuing the step from `from` to `to`. */
export function beyond(from: Cell, to: Cell): Cell {
  return { col: 2 * to.col - from.col, row: 2 * to.row - from.row };
}

/** True when the square lies on a side x side floor. */
export function isOnFloor(cell: Cell, side: number): boolean {
  return cell.col >= 0 && cell.row >= 0 && cell.col < side && cell.row < side;
}

/** The robot on a square, or null. */
export function robotAt(floor: Floor, cell: Cell): Robot | null {
  return floor.robots.find((robot) => isSameCell(robot, cell)) ?? null;
}

/** The heap on a square, or null. */
export function heapAt(floor: Floor, cell: Cell): Heap | null {
  return floor.heaps.find((heap) => isSameCell(heap, cell)) ?? null;
}

/** True when the player, a robot or a heap stands on the square. */
export function isTaken(floor: Floor, cell: Cell): boolean {
  return (
    isSameCell(floor.player, cell) || robotAt(floor, cell) !== null || heapAt(floor, cell) !== null
  );
}

/** The eight neighbours of a square in reading order (row by row, then column), on the floor. */
export function neighboursOf(cell: Cell, side: number): Cell[] {
  const squares: Cell[] = [];
  for (let row = cell.row - 1; row <= cell.row + 1; row += 1) {
    for (let col = cell.col - 1; col <= cell.col + 1; col += 1) {
      const square = { col, row };
      if (!isSameCell(square, cell) && isOnFloor(square, side)) squares.push(square);
    }
  }
  return squares;
}
