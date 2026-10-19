// apps/flock-tilt/src/levels/flock-tilt-solver.ts
// Exact par for levels, tests and hints: breadth-first search over the real engine (game-kit's
// createBfsSolver), keyed by the flock's places. The same tilts as create's field search, so the
// par a level records equals the par its field carries.
import { applyMove } from '@e07/flock-tilt/rules/apply-move.ts';
import { fieldKey } from '@e07/flock-tilt/rules/field-search.ts';
import { listMoves } from '@e07/flock-tilt/rules/list-moves.ts';
import { outcome } from '@e07/flock-tilt/rules/outcome.ts';
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { createBfsSolver } from '@e07/game-kit/solver/engine-solver.ts';

import type { FlockTiltMove, FlockTiltState } from '@e07/flock-tilt/rules/flock-tilt-types.ts';
import type { Solver } from '@e07/game-kit/contract/levels.ts';

export const FLOCK_TILT_SOLVER: Solver<FlockTiltState, FlockTiltMove> = createBfsSolver({
  engine: { listMoves, applyMove, outcome },
  key: fieldKey,
});

/** Budget for a hint on the phone: a 7 x 7 field solves far below it. */
export const HINT_MAX_NODES = 20_000;

/** rules.hints.suggest: the first tilt of a shortest winning line, or null when none is found. */
export function suggestTilt(state: FlockTiltState): FlockTiltMove | null {
  if (outcome(state).kind !== 'playing') return null;
  const result = FLOCK_TILT_SOLVER.solve(state, HINT_MAX_NODES);
  // A playing field is never already won, so a solved line has at least one tilt.
  return result.kind === 'solved' ? pickAt(result.line, 0) : null;
}
