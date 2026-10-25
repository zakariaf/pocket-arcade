// apps/toggle-drop/src/rules/intent-to-move.ts
import { listMoves } from './list-moves.ts';

import type { ToggleDropMove, ToggleDropState } from './toggle-drop-types.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';

/**
 * The move a tap points at, before legality: a tap anywhere in a column, from its chute down to
 * its cup, drops a ball there. Toggle Drop uses no other gesture (panMode 'none').
 */
function candidate(intent: InputIntent): ToggleDropMove | null {
  switch (intent.kind) {
    case 'tap':
      return intent.target.regionId === 'board' ? { kind: 'drop', col: intent.target.col } : null;
    case 'long-press':
    case 'swipe':
    case 'drag-end':
    case 'aim':
      return null;
  }
}

/**
 * Pure: an intent becomes a legal move or nothing. Legality is "listMoves(state) lists it" and
 * nothing else, so a finished run (listMoves is empty) and a column off the board both give null.
 */
export function intentToMove(state: ToggleDropState, intent: InputIntent): ToggleDropMove | null {
  const move = candidate(intent);
  if (move === null) return null;
  return listMoves(state).some((listed) => listed.col === move.col) ? move : null;
}
