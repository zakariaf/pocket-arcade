// apps/tap-flip/src/rules/outcome.ts
import { TUNING } from './tap-flip-tuning.ts';

import type { TapFlipState } from './tap-flip-types.ts';
import type { Outcome } from '@e07/game-kit/contract/game-engine.ts';

export function isCleared(state: TapFlipState): boolean {
  return state.cells.every((cell) => cell === 0);
}

/** Won beats lost: clearing the board with the last move still wins. */
export function outcome(state: TapFlipState): Outcome {
  if (isCleared(state)) {
    return { kind: 'won', score: (state.maxMoves - state.moves) * TUNING.pointsPerSpareMove };
  }
  return state.moves >= state.maxMoves
    ? { kind: 'lost', reasonKey: 'tap-flip.lose.out-of-moves' }
    : { kind: 'playing' };
}
