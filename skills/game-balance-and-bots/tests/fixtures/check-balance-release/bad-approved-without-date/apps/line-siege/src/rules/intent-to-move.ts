// apps/line-siege/src/rules/intent-to-move.ts
// Spec 13 (line-siege) controls: "tap a block, then tap the grid (dragging works too)". A drag
// from a tray slot to a board cell places that slot's block with its top-start (anchor) cell on the
// released cell. Tap-then-tap: the tray is the engine's select region, so a tap on a slot only
// selects it (the board host keeps the selection as UI state and returns null here); the next tap
// on a board cell arrives with `selected` set and places that slot's block there. The finger lift
// is applied once, in the gesture layer: no offset is added here, so the ghost cell is the placed
// cell. Pure: legality is "listMoves offers this move", nothing else.
import { listMoves } from './list-moves.ts';

import type { LineSiegeMove, LineSiegeState } from './line-siege-types.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

/** The regions whose taps select instead of act (GameEngine.selectRegions). */
export const LINE_SIEGE_SELECT_REGIONS: readonly string[] = ['tray'];

/** The tray lies in one row (portrait) or one column (wide), so the slot is col + row. */
function traySlot(target: BoardTarget): number | null {
  return target.regionId === 'tray' ? target.col + target.row : null;
}

/** The block of tray slot `from`, anchored on board cell `to`, or null. */
function placeMove(from: BoardTarget | null, to: BoardTarget | null): LineSiegeMove | null {
  const trayIndex = from === null ? null : traySlot(from);
  if (trayIndex === null || to?.regionId !== 'board') return null;
  return { kind: 'place-block', trayIndex, col: to.col, row: to.row };
}

function candidate(intent: InputIntent): LineSiegeMove | null {
  switch (intent.kind) {
    case 'drag-end':
      return placeMove(intent.from, intent.to);
    case 'tap':
      return placeMove(intent.selected, intent.target);
    case 'long-press':
    case 'swipe':
    case 'aim':
      return null;
  }
}

/** Pure: an intent becomes a legal move or nothing. Legality lives here, never in gestures. */
export function intentToMove(state: LineSiegeState, intent: InputIntent): LineSiegeMove | null {
  const move = candidate(intent);
  if (move === null) return null;
  const wanted = JSON.stringify(move);
  return listMoves(state).some((listed) => JSON.stringify(listed) === wanted) ? move : null;
}
