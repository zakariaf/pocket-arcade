// apps/toggle-drop/src/rules/drop-path.ts
import type { PegCell, Side } from './toggle-drop-types.ts';

/** The pegs of a board: what a falling ball meets. */
export type PegBoard = {
  readonly cols: number;
  readonly rows: number;
  readonly pegs: readonly PegCell[];
};

/** One peg row the ball passed: its column there and the switch it met (null: none). */
export type PathStep = { readonly row: number; readonly col: number; readonly side: Side | null };

/** Where a ball dropped in a column goes: each peg row it passes, and its landing column. */
export type DropPath = { readonly steps: readonly PathStep[]; readonly landing: number };

/** The switch at a cell; outside the board there is none. */
export function pegAt(board: PegBoard, row: number, col: number): PegCell {
  const isInside = row >= 0 && row < board.rows && col >= 0 && col < board.cols;
  return isInside ? (board.pegs[row * board.cols + col] ?? -1) : -1;
}

/** The column a switch sends the ball to: one to its side, or straight on against a wall. */
export function nextColumn(cols: number, col: number, side: Side): number {
  const to = side === 0 ? col - 1 : col + 1;
  return to < 0 || to >= cols ? col : to;
}

/**
 * The fall of one ball dropped in `col`: at each peg row a switch in its column sends it one
 * column to the switch's side (a ball meets each row once, so its own flips never change its path).
 */
export function dropPath(board: PegBoard, col: number): DropPath {
  const steps: PathStep[] = [];
  let at = col;
  for (let row = 0; row < board.rows; row += 1) {
    const peg = pegAt(board, row, at);
    const side = peg === -1 ? null : peg;
    steps.push({ row, col: at, side });
    if (side !== null) at = nextColumn(board.cols, at, side);
  }
  return { steps, landing: at };
}

/** The pegs after a ball passed: every switch on its path flipped once. */
export function flipPath(board: PegBoard, path: DropPath): PegCell[] {
  const pegs = [...board.pegs];
  for (const step of path.steps) {
    if (step.side !== null) pegs[step.row * board.cols + step.col] = step.side === 0 ? 1 : 0;
  }
  return pegs;
}
