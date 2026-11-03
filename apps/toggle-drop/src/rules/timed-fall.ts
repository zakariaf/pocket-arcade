// apps/toggle-drop/src/rules/timed-fall.ts
// Simulate-then-replay as a discrete run: the ball's path is dropPath's (the column it is in on
// each peg row and where it lands), and it falls FALL_PER_TICK board units per fixed step of the
// real-time loop (1/120 s), so it crosses each line of the board a whole number of steps after the
// one before. applyMove times its events with fallMark; the board turns them into tracks that
// replay the fall. Pure and deterministic.
import { STEP_MS } from '@e07/game-kit/timeline/fixed-step.ts';

/** Board units per column and per peg row: the board draws each cell as a 120-unit square. */
export const CELL_UNITS = 120;
/** How far the ball falls in one fixed step: 20 steps (1/6 s) per peg row. */
export const FALL_PER_TICK = 6;
/** Hard cap on the clock of a fall: time stops here (the tallest board lands after 120 ticks). */
export const MAX_TICKS = 1200;

/** Where the ball is on a line of the board (board units) and when (whole timeline ms). */
export type FallMark = { readonly x: number; readonly y: number; readonly atMs: number };

/**
 * The ball in column `col` on line `line` of the board: line 0 is the drop above the first peg
 * row, peg row r is line r + 1 and the landing is line rows + 1. The ball is in the middle of its
 * column, and the clock counts the fixed steps of the fall so far, at most MAX_TICKS.
 */
export function fallMark(col: number, line: number): FallMark {
  const y = line * CELL_UNITS;
  const ticks = Math.min(y / FALL_PER_TICK, MAX_TICKS);
  return { x: col * CELL_UNITS + CELL_UNITS / 2, y, atMs: Math.round(ticks * STEP_MS) };
}
