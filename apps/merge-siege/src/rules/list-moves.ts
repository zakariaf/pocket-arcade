// apps/merge-siege/src/rules/list-moves.ts
// Spec 10 RULES "The list of moves allowed in a state": the swipes that change the board (a tile
// slides, merges, smashes or is lost), in the fixed order up, down, left, right; empty exactly
// when the run is over.
import { DIRECTIONS } from './board-cells.ts';
import { outcome } from './outcome.ts';
import { hasSlideEffect, slideTiles } from './slide-tiles.ts';

import type { MergeSiegeMove, MergeSiegeState } from './merge-siege-types.ts';

export function listMoves(state: MergeSiegeState): MergeSiegeMove[] {
  if (outcome(state).kind !== 'playing') return [];
  return DIRECTIONS.filter((direction) => hasSlideEffect(slideTiles(state.cells, direction))).map(
    (direction): MergeSiegeMove => ({ kind: 'swipe', direction }),
  );
}
