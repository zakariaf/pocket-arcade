// apps/tap-flip/src/rules/outcome.ts
import type { TapFlipState } from './tap-flip-types.ts';
import type { Outcome } from '@e07/game-kit/contract/game-engine.ts';

/** Score per move left over when the board goes dark. */
export const POINTS_PER_SPARE_MOVE = 10;

export function isCleared(state: TapFlipState): boolean {
  return state.cells.every((cell) => cell === 0);
}

/** Won beats lost: clearing the board with the last move still wins. */
export function outcome(state: TapFlipState): Outcome {
  if (isCleared(state)) {
    return { kind: 'won', score: (state.maxMoves - state.moves) * POINTS_PER_SPARE_MOVE };
  }
  return state.moves >= state.maxMoves
    ? { kind: 'lost', reasonKey: 'tap-flip.lose.out-of-moves' }
    : { kind: 'playing' };
}
