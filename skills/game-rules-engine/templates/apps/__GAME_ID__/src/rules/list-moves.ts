// apps/__GAME_ID__/src/rules/list-moves.ts
import { outcome } from './outcome.ts';

import type { __GAME_PASCAL__Move, __GAME_PASCAL__State } from './__GAME_ID__-types.ts';

/** Every legal move, in a fixed order (bots, solvers and replays depend on it). Empty when over. */
export function listMoves(state: __GAME_PASCAL__State): __GAME_PASCAL__Move[] {
  if (outcome(state).kind !== 'playing') return [];
  const moves: __GAME_PASCAL__Move[] = [];
  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) moves.push({ kind: 'flip', col, row });
  }
  return moves;
}
