// apps/stepstone/src/rules/list-moves.ts
import { targetsOf } from './hops.ts';

import type { StepstoneMove, StepstoneState } from './stepstone-types.ts';

/**
 * Every legal hop, in cell order (bots, solvers and replays depend on it): the live stones the
 * frog's hop reaches. Empty exactly when the run is over: on the flag the frog has no hop, and a
 * stranded frog has no stone in reach.
 */
export function listMoves(state: StepstoneState): StepstoneMove[] {
  return targetsOf(state).map((to) => ({ kind: 'hop', to }));
}
