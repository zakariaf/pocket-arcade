// apps/trail-clear/src/rules/list-moves.ts
// Every legal placement of the offered tile, in a fixed order; empty exactly when the run is over
// (the bag is empty, or the tile fits nowhere).
import { fittingMoves } from './placement.ts';

import type { TrailClearMove, TrailClearState } from './trail-clear-types.ts';

export function listMoves(state: TrailClearState): TrailClearMove[] {
  return state.offered === null ? [] : fittingMoves(state.cells, state.offered);
}
