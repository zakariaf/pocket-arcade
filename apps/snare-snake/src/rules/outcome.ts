// apps/snare-snake/src/rules/outcome.ts
// Spec 10 RULES "Is it over?": won when every critter is caught (won beats lost: the last critter
// caught on the last move still wins), lost when the moves run out, or when the snake is tangled
// (no allowed move: walls and critters on every free side), otherwise playing.
import { openDirections } from './steering.ts';

import type { SnareSnakeState } from './snare-snake-types.ts';
import type { Outcome } from '@e07/game-kit/contract/game-engine.ts';

/** The two ways of losing, one catalog key each (S7 shows the reason). */
export const LOSE_OUT_OF_MOVES = 'snare-snake.lose.out-of-moves';
export const LOSE_TANGLED = 'snare-snake.lose.tangled';

export function outcome(state: SnareSnakeState): Outcome {
  if (state.critters.length === 0) return { kind: 'won', score: state.score };
  if (state.moves >= state.maxMoves) return { kind: 'lost', reasonKey: LOSE_OUT_OF_MOVES };
  if (openDirections(state).length === 0) return { kind: 'lost', reasonKey: LOSE_TANGLED };
  return { kind: 'playing' };
}
