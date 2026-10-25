// apps/toggle-drop/src/rules/list-moves.ts
import { areCupsFull } from './cups.ts';

import type { ToggleDropMove, ToggleDropState } from './toggle-drop-types.ts';

/**
 * Every legal move, in a fixed order (bots, solvers and replays depend on it): a drop in each
 * column, left to right, while balls are left and a cup still needs one. Empty when the run is over.
 */
export function listMoves(state: ToggleDropState): ToggleDropMove[] {
  if (state.ballsLeft <= 0 || areCupsFull(state)) return [];
  return Array.from({ length: state.cols }, (_, col): ToggleDropMove => ({ kind: 'drop', col }));
}
