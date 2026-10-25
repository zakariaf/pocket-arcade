// apps/stepstone/src/levels/stepstone-solver.ts
import { createBfsSolver } from '@e07/game-kit/solver/engine-solver.ts';
import { applyMove } from '@e07/stepstone/rules/apply-move.ts';
import { listMoves } from '@e07/stepstone/rules/list-moves.ts';
import { outcome } from '@e07/stepstone/rules/outcome.ts';

import type { Solver } from '@e07/game-kit/contract/levels.ts';
import type { StepstoneMove, StepstoneState } from '@e07/stepstone/rules/stepstone-types.ts';

/**
 * Exact par (spec 8.1) by breadth-first search keyed by the frog's stone. Stones sink only behind
 * the frog, and the stone at hop j of a shortest route is exactly j hops from the start, so no stone
 * sunk on a shortest way to a stone lies further along a shortest route from it: the first visit of
 * each stone keeps every shortest route open. A 7 x 7 pond has at most 49 stones to visit.
 */
export const STEPSTONE_SOLVER: Solver<StepstoneState, StepstoneMove> = createBfsSolver({
  engine: { listMoves, applyMove, outcome },
  key: (state) => String(state.frog),
});

/** Budget for a hint on the phone: a 7 x 7 pond has at most 49 stones to visit. */
export const HINT_MAX_NODES = 2_000;

/**
 * rules.hints.suggest (spec 8.5: "The game's solver suggests the next good move"): the first hop of
 * a shortest route from this state, or null when the run is over or no route is left.
 */
export function suggestHop(state: StepstoneState): StepstoneMove | null {
  const result = STEPSTONE_SOLVER.solve(state, HINT_MAX_NODES);
  return result.kind === 'solved' ? (result.line[0] ?? null) : null;
}
