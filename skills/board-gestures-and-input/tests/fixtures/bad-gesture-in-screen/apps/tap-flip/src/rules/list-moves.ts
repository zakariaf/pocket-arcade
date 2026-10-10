// apps/tap-flip/src/rules/list-moves.ts
import { outcome } from './outcome.ts';

import type { TapFlipMove, TapFlipState } from './tap-flip-types.ts';

/** Every legal move, in a fixed order (bots, solvers and replays depend on it). Empty when over. */
export function listMoves(state: TapFlipState): TapFlipMove[] {
  if (outcome(state).kind !== 'playing') return [];
  const moves: TapFlipMove[] = [];
  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) moves.push({ kind: 'flip', col, row });
  }
  return moves;
}
