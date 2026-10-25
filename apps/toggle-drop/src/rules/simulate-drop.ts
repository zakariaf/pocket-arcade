// apps/toggle-drop/src/rules/simulate-drop.ts
// Simulate-then-replay: applyMove runs the ball's fall here, in the real-time loop's fixed step
// (1/120 s), and returns its timed points. The game stays turn-based for saves, undo, bots and
// goldens; the board turns the events built from these points into tracks that replay the fall.
import { STEP_MS } from '@e07/game-kit/timeline/fixed-step.ts';

import { nextColumn, pegAt } from './drop-path.ts';

import type { PegBoard } from './drop-path.ts';
import type { Side } from './toggle-drop-types.ts';

/** Board units per column and per peg row: the board draws each cell as a 120-unit square. */
export const CELL_UNITS = 120;
/** How far the ball falls in one fixed step: 20 ticks (1/6 s) per peg row. */
export const FALL_PER_TICK = 6;
/** Hard cap: a fall always ends (the tallest board lands after 120 ticks). */
export const MAX_TICKS = 1200;

/** The whole fall: every point where it changed (the drop, each peg row, the landing) and its landing. */
export type Fall = { readonly points: readonly FallPoint[]; readonly land: FallPoint };

/** Where the fall changed: the drop, each peg row reached, and the landing. */
export type FallPoint = {
  readonly kind: 'start' | 'row' | 'land';
  /** The column the ball is in (at the start and on a row) or lands in. */
  readonly col: number;
  /** The peg row reached (-1 at the start, the row count at the landing). */
  readonly row: number;
  /** The switch the ball met on this row (null: none, and always at the start and landing). */
  readonly side: Side | null;
  readonly x: number;
  readonly y: number;
  readonly atMs: number;
  /** True only for a landing forced by maxTicks (never on a real board). */
  readonly isCapped: boolean;
};

const centerX = (col: number): number => col * CELL_UNITS + CELL_UNITS / 2;
const atMsOf = (tick: number): number => Math.round(tick * STEP_MS);

type Ball = { readonly x: number; readonly y: number; readonly vx: number; readonly col: number };

/** On a row line: record what the ball met and steer it toward the switch's side. */
function reachRow(board: PegBoard, ball: Ball, tick: number): { ball: Ball; point: FallPoint } {
  const row = ball.y / CELL_UNITS - 1;
  const x = centerX(ball.col);
  const peg = pegAt(board, row, ball.col);
  const side = peg === -1 ? null : peg;
  const to = side === null ? ball.col : nextColumn(board.cols, ball.col, side);
  const point: FallPoint = {
    kind: 'row',
    col: ball.col,
    row,
    side,
    x,
    y: ball.y,
    atMs: atMsOf(tick),
    isCapped: false,
  };
  return { ball: { x, y: ball.y, vx: (to - ball.col) * FALL_PER_TICK, col: to }, point };
}

/**
 * The fall of a ball dropped in `col`, one fixed step at a time: it falls FALL_PER_TICK units per
 * tick; on each peg row a switch in its column sends it one column to its side over the next row
 * (straight on against a wall); it lands under the last row. Pure and deterministic.
 */
export function simulateDrop(board: PegBoard, col: number, maxTicks = MAX_TICKS): Fall {
  const floorY = (board.rows + 1) * CELL_UNITS;
  let ball: Ball = { x: centerX(col), y: 0, vx: 0, col };
  const points: FallPoint[] = [
    { kind: 'start', col, row: -1, side: null, x: ball.x, y: 0, atMs: 0, isCapped: false },
  ];
  for (let tick = 1; tick <= maxTicks; tick += 1) {
    ball = { ...ball, x: ball.x + ball.vx, y: ball.y + FALL_PER_TICK };
    if (ball.y === floorY) {
      const land: FallPoint = {
        kind: 'land',
        col: ball.col,
        row: board.rows,
        side: null,
        x: centerX(ball.col),
        y: floorY,
        atMs: atMsOf(tick),
        isCapped: false,
      };
      return { points: [...points, land], land };
    }
    if (ball.y % CELL_UNITS === 0) {
      const reached = reachRow(board, ball, tick);
      ball = reached.ball;
      points.push(reached.point);
    }
  }
  const land: FallPoint = {
    kind: 'land',
    col: ball.col,
    row: board.rows,
    side: null,
    x: ball.x,
    y: ball.y,
    atMs: atMsOf(maxTicks),
    isCapped: true,
  };
  return { points: [...points, land], land };
}
