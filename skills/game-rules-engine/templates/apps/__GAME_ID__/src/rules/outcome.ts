// apps/__GAME_ID__/src/rules/outcome.ts
import { TUNING } from './__GAME_ID__-tuning.ts';

import type { __GAME_PASCAL__State } from './__GAME_ID__-types.ts';
import type { Outcome } from '@e07/game-kit/contract/game-engine.ts';

export function isCleared(state: __GAME_PASCAL__State): boolean {
  return state.cells.every((cell) => cell === 0);
}

/** Won beats lost: clearing the board with the last move still wins. */
export function outcome(state: __GAME_PASCAL__State): Outcome {
  if (isCleared(state)) {
    return { kind: 'won', score: (state.maxMoves - state.moves) * TUNING.pointsPerSpareMove };
  }
  return state.moves >= state.maxMoves
    ? { kind: 'lost', reasonKey: '__GAME_ID__.lose.out-of-moves' }
    : { kind: 'playing' };
}
