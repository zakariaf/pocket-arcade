// apps/line-siege/src/rules/list-moves.ts
// Every legal placement in a fixed order; empty exactly when the run is over.
import { outcome } from './outcome.ts';
import { fittingMoves } from './placement.ts';

import type { LineSiegeMove, LineSiegeState } from './line-siege-types.ts';

export function listMoves(state: LineSiegeState): LineSiegeMove[] {
  return outcome(state).kind === 'playing' ? fittingMoves(state) : [];
}
