// apps/flock-tilt/src/levels/flock-tilt-solver.ts
// Exact par for levels, tests and hints: breadth-first search over the real engine (game-kit's
// createBfsSolver), keyed by the flock's places. The same tilts as create's field search, so the
// par a level records equals the par its field carries.
import { applyMove } from '@e07/flock-tilt/rules/apply-move.ts';
import { fieldKey, solveField } from '@e07/flock-tilt/rules/field-search.ts';
import { listMoves } from '@e07/flock-tilt/rules/list-moves.ts';
import { outcome } from '@e07/flock-tilt/rules/outcome.ts';
import { createBfsSolver } from '@e07/game-kit/solver/engine-solver.ts';

import type { FlockTiltMove, FlockTiltState } from '@e07/flock-tilt/rules/flock-tilt-types.ts';
import type { Solver } from '@e07/game-kit/contract/levels.ts';

export const FLOCK_TILT_SOLVER: Solver<FlockTiltState, FlockTiltMove> = createBfsSolver({
  engine: { listMoves, applyMove, outcome },
  key: fieldKey,
});

/** Budget for a hint on the phone: a 7 x 7 field solves far below it. */
export const HINT_MAX_NODES = 20_000;

/**
 * rules.hints.suggest: the first tilt of a shortest winning line within the tilts left, or null
 * when none is found. It runs create's field search (bare flocks, no engine states), which gives
 * the engine solver's first tilt on every shipped level and daily field (flock-tilt-solver.test).
 */
export function suggestTilt(state: FlockTiltState): FlockTiltMove | null {
  if (outcome(state).kind !== 'playing') return null;
  const solution = solveField(state, state.tiltLimit - state.tilts, HINT_MAX_NODES);
  const [first] = solution?.line ?? [];
  return first === undefined ? null : { kind: 'tilt', direction: first };
}
