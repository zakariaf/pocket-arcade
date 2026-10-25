// apps/flock-tilt/src/rules/list-moves.ts
import { endedStatus } from './field-status.ts';
import { DIRECTIONS, tiltField } from './tilt-field.ts';

import type { FlockTiltMove, FlockTiltState } from './flock-tilt-types.ts';

/**
 * Every legal tilt, in a fixed order (bots, solvers and replays depend on it): a tilt that moves
 * nothing is not a move, so a wasted swipe never counts. Empty exactly when the run is over.
 */
export function listMoves(state: FlockTiltState): FlockTiltMove[] {
  if (endedStatus(state) !== null) return [];
  return DIRECTIONS.filter((direction) => tiltField(state, direction).slides.length > 0).map(
    (direction) => ({ kind: 'tilt', direction }),
  );
}
