// apps/trail-clear/src/rules/intent-to-move.ts
// Spec 13 (trail-clear) controls: "Drag the offered tile onto the board". The tray shows the
// offered tile once per distinct turn; a drag from a slot to a board cell places that turn there.
// Tap-then-tap: the tray is the engine's select region, so a tap on a slot only selects it (the
// board host keeps the selection as UI state and this returns null); the next tap on a cell arrives
// with `selected` set and places that turn there. The finger lift is applied once, in the gesture
// layer: no offset is added here. Pure: legality is "listMoves offers this move", nothing else.
import { listMoves } from './list-moves.ts';
import { distinctTurns } from './tiles.ts';

import type { TrailClearMove, TrailClearState } from './trail-clear-types.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

/** The regions whose taps select instead of act (GameEngine.selectRegions). */
export const TRAIL_CLEAR_SELECT_REGIONS: readonly string[] = ['tray'];

/** The quarter turns of tray slot `from` (the tray lies in one row or one column), or null. */
function turnsOf(state: TrailClearState, from: BoardTarget | null): number | null {
  if (from?.regionId !== 'tray' || state.offered === null) return null;
  return distinctTurns(state.offered)[from.col + from.row] ?? null;
}

/** The turn of tray slot `from`, placed on board cell `to`, or null. */
function placeMove(
  state: TrailClearState,
  from: BoardTarget | null,
  to: BoardTarget | null,
): TrailClearMove | null {
  const turns = turnsOf(state, from);
  if (turns === null || to?.regionId !== 'board') return null;
  return { kind: 'place-tile', turns, col: to.col, row: to.row };
}

function candidate(state: TrailClearState, intent: InputIntent): TrailClearMove | null {
  switch (intent.kind) {
    case 'drag-end':
      return placeMove(state, intent.from, intent.to);
    case 'tap':
      return placeMove(state, intent.selected, intent.target);
    case 'long-press':
    case 'swipe':
    case 'aim':
      return null;
  }
}

/** Pure: an intent becomes a legal move or nothing. Legality lives here, never in gestures. */
export function intentToMove(state: TrailClearState, intent: InputIntent): TrailClearMove | null {
  const move = candidate(state, intent);
  if (move === null) return null;
  const wanted = JSON.stringify(move);
  return listMoves(state).some((listed) => JSON.stringify(listed) === wanted) ? move : null;
}
