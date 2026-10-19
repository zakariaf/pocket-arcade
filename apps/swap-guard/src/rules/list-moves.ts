// apps/swap-guard/src/rules/list-moves.ts
import { squaresAround } from './board-grid.ts';
import { outcome } from './outcome.ts';

import type { SwapGuardMove, SwapGuardState } from './swap-guard-types.ts';

/**
 * Every legal swap, in board order: one with each square around the guard (diagonals included),
 * an enemy or an empty tile alike. Empty once the run is over.
 */
export function listMoves(state: SwapGuardState): SwapGuardMove[] {
  if (outcome(state).kind !== 'playing') return [];
  return squaresAround(state.size, state.guard).map((cell) => ({ kind: 'swap', cell }));
}
