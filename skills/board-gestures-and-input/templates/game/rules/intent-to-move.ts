// apps/__GAME_ID__/src/rules/intent-to-move.ts
import { listMoves } from './list-moves.ts';

import type { __GAME_PASCAL__Move, __GAME_PASCAL__State } from './__GAME_ID__-types.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';

/** The move a tap points at, before legality: a tapped board cell flips. */
function candidate(intent: InputIntent): __GAME_PASCAL__Move | null {
  switch (intent.kind) {
    case 'tap':
      return intent.target.regionId === 'board'
        ? { kind: 'flip', col: intent.target.col, row: intent.target.row }
        : null;
    case 'long-press':
    case 'swipe':
    case 'drag-end':
    case 'aim':
      return null;
  }
}

/** Every move is a flip, so the cell decides; a game with several move kinds compares them all. */
function isSameMove(a: __GAME_PASCAL__Move, b: __GAME_PASCAL__Move): boolean {
  return a.col === b.col && a.row === b.row;
}

/**
 * Pure: an intent becomes a legal move or nothing. Legality is "listMoves(state) lists it" and
 * nothing else, so a finished run (listMoves is empty) and a cell off the grid both give null.
 */
export function intentToMove(
  state: __GAME_PASCAL__State,
  intent: InputIntent,
): __GAME_PASCAL__Move | null {
  const move = candidate(intent);
  if (move === null) return null;
  return listMoves(state).some((listed) => isSameMove(listed, move)) ? move : null;
}
