// apps/scrap-shove/src/rules/solve-floor.ts
// The exact solver of a floor: breadth-first search over the real rules, so the first win it
// meets has the fewest moves (par). create() uses it to lay out only winnable floors, the levels
// use it for par and the hints use it for the next good move.
import { bfsSolve } from '@e07/game-kit/solver/bfs-solve.ts';
import { engineProblem } from '@e07/game-kit/solver/search-problem.ts';

import { applyMove } from './apply-move.ts';
import { listMoves } from './list-moves.ts';
import { outcome } from './outcome.ts';

import type { ScrapShoveMove, ScrapShoveState } from './scrap-shove-types.ts';
import type { SolveResult } from '@e07/game-kit/contract/levels.ts';

/**
 * Two floors with the same key play out identically: the player, every robot with its id (ids
 * break ties in the robots' order) and the heap squares. Heap ids and the shoved mark change
 * events, never the play, so they stay out and more floors merge.
 */
export function floorKey(state: ScrapShoveState): string {
  const robots = state.robots.map(
    (robot) =>
      `${String(robot.id)}${robot.kind.charAt(0)}${String(robot.col)}.${String(robot.row)}`,
  );
  const heaps = state.heaps.map((heap) => heap.row * state.cols + heap.col).sort((a, b) => a - b);
  return `${String(state.player.col)}.${String(state.player.row)}|${robots.join(',')}|${heaps.join(',')}`;
}

/** The fewest-moves win from `start`, unsolvable, or over the node budget. */
export function solveFloor(
  start: ScrapShoveState,
  maxNodes: number,
): SolveResult<ScrapShoveState, ScrapShoveMove> {
  return bfsSolve(engineProblem({ listMoves, applyMove, outcome }, floorKey, start), maxNodes);
}
