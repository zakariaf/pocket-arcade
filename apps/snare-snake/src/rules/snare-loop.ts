// apps/snare-snake/src/rules/snare-loop.ts
// Closing a loop (design notes, rule 4): the loop is the cells from the head to the bitten segment.
// It catches every critter inside it (a cell no path from outside the board reaches without
// crossing the loop) or sharing a side with one of its cells (the design fix: a tight curl next to
// a frozen critter snares it).
import { neighboursOf, touchingCells } from './board-grid.ts';

import type { Grid } from './board-grid.ts';

/** The cells inside the loop, in board order. */
export function enclosedBy(grid: Grid, loop: readonly number[]): number[] {
  // A frame of one cell around the board: everything the flood from its corner reaches is outside.
  const frame = { cols: grid.cols + 2, rows: grid.rows + 2 };
  const framed = (cell: number): number =>
    (Math.floor(cell / grid.cols) + 1) * frame.cols + (cell % grid.cols) + 1;
  const wall = new Set(loop.map(framed));
  const outside = new Set([0]);
  const stack = [0];
  for (let index = stack.pop(); index !== undefined; index = stack.pop()) {
    for (const next of neighboursOf(frame, index)) {
      if (wall.has(next) || outside.has(next)) continue;
      outside.add(next);
      stack.push(next);
    }
  }
  return Array.from({ length: grid.cols * grid.rows }, (_, cell) => cell).filter(
    (cell) => !wall.has(framed(cell)) && !outside.has(framed(cell)),
  );
}

/** Every cell whose critter the loop catches: inside it, or sharing a side with one of its cells. */
export function snaredBy(
  grid: Grid,
  loop: readonly number[],
  enclosed: readonly number[],
): Set<number> {
  return new Set([...enclosed, ...touchingCells(grid, loop)]);
}
