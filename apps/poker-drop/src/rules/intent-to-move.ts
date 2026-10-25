// apps/poker-drop/src/rules/intent-to-move.ts
import { listMoves } from './list-moves.ts';

import type { PokerDropMove, PokerDropState } from './poker-drop-types.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';

/** The move a tap points at, before legality: a tap anywhere in a well column drops into it. */
function candidate(intent: InputIntent): PokerDropMove | null {
  switch (intent.kind) {
    case 'tap':
      return intent.target.regionId === 'well'
        ? { kind: 'drop-card', col: intent.target.col }
        : null;
    case 'long-press':
    case 'swipe':
    case 'drag-end':
    case 'aim':
      return null;
  }
}

/**
 * Pure: an intent becomes a legal move or nothing. Legality is "listMoves(state) lists it" and
 * nothing else, so a full column, a column off the well and a finished run all give null.
 */
export function intentToMove(state: PokerDropState, intent: InputIntent): PokerDropMove | null {
  const move = candidate(intent);
  if (move === null) return null;
  return listMoves(state).some((listed) => listed.col === move.col) ? move : null;
}
