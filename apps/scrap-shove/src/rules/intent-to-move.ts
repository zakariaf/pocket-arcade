// apps/scrap-shove/src/rules/intent-to-move.ts
import { isSameMove } from './apply-move.ts';
import { isSameCell } from './floor-squares.ts';
import { listMoves, moveOnto } from './list-moves.ts';

import type { ScrapShoveMove, ScrapShoveState } from './scrap-shove-types.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';

/**
 * The move a tap points at, before legality: the player's own square waits, any other square is
 * a step onto it or a shove of the scrap on it. Scrap Shove is played with taps only.
 */
function candidate(state: ScrapShoveState, intent: InputIntent): ScrapShoveMove | null {
  switch (intent.kind) {
    case 'tap': {
      const { regionId, col, row } = intent.target;
      if (regionId !== 'board') return null;
      const square = { col, row };
      return isSameCell(square, state.player) ? { kind: 'wait' } : moveOnto(state, square);
    }
    case 'long-press':
    case 'swipe':
    case 'drag-end':
    case 'aim':
      return null;
  }
}

/**
 * Pure: an intent becomes a legal move or nothing. Legality is "listMoves(state) lists it" and
 * nothing else, so a finished floor (listMoves is empty), a square that is not next to the player
 * and a heap that cannot move all give null.
 */
export function intentToMove(state: ScrapShoveState, intent: InputIntent): ScrapShoveMove | null {
  const move = candidate(state, intent);
  if (move === null) return null;
  return listMoves(state).some((legal) => isSameMove(legal, move)) ? move : null;
}
