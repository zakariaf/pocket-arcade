// apps/poker-drop/src/rules/list-moves.ts
import { outcome } from './outcome.ts';
import { COLS, hasRoom } from './well.ts';

import type { PokerDropMove, PokerDropState } from './poker-drop-types.ts';

/** A drop into every column with room, left to right (a fixed order); empty once the run is over. */
export function listMoves(state: PokerDropState): PokerDropMove[] {
  if (outcome(state).kind !== 'playing') return [];
  const moves: PokerDropMove[] = [];
  for (let col = 0; col < COLS; col += 1) {
    if (hasRoom(state.cells, col)) moves.push({ kind: 'drop-card', col });
  }
  return moves;
}
