// apps/toggle-drop/src/rules/outcome.ts
import { areCupsFull } from './cups.ts';

import type { ToggleDropState } from './toggle-drop-types.ts';
import type { Outcome } from '@e07/game-kit/contract/game-engine.ts';

/** The one way of losing: the last ball is spent and a cup still needs one. */
export const OUT_OF_BALLS = 'toggle-drop.lose.out-of-balls';

/**
 * Won when every cup is full (the score is the balls left over), lost when the balls are spent
 * first, otherwise still playing. A last ball that fills the last cup wins.
 */
export function outcome(state: ToggleDropState): Outcome {
  if (areCupsFull(state)) return { kind: 'won', score: state.ballsLeft };
  if (state.ballsLeft <= 0) return { kind: 'lost', reasonKey: OUT_OF_BALLS };
  return { kind: 'playing' };
}
