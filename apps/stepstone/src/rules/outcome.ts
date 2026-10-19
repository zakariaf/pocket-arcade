// apps/stepstone/src/rules/outcome.ts
import { targetsOf } from './hops.ts';

import type { StepstoneState } from './stepstone-types.ts';
import type { Outcome } from '@e07/game-kit/contract/game-engine.ts';

export const STUCK_REASON = 'stepstone.lose.stuck';

/**
 * Won on the flag (the score is the hops made; stars compare them with par, spec 8.1); lost when
 * no stone is in reach of the frog's hop (undo is the way out); otherwise still playing.
 */
export function outcome(state: StepstoneState): Outcome {
  if (state.cells[state.frog] === 'flag') return { kind: 'won', score: state.moves };
  return targetsOf(state).length === 0
    ? { kind: 'lost', reasonKey: STUCK_REASON }
    : { kind: 'playing' };
}
