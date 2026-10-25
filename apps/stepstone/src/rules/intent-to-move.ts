// apps/stepstone/src/rules/intent-to-move.ts
import { listMoves } from './list-moves.ts';

import type { StepstoneMove, StepstoneState } from './stepstone-types.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

/** The pond cell a board target names, or null off the pond (no wrapping into the next row). */
function cellOf(state: StepstoneState, target: BoardTarget): number | null {
  const { col, row } = target;
  const isInside = target.regionId === 'board' && col >= 0 && row >= 0;
  return isInside && col < state.side && row < state.side ? row * state.side + col : null;
}

/** The hop a tap points at, before legality: a tapped pond cell is the landing stone. */
function candidate(state: StepstoneState, intent: InputIntent): StepstoneMove | null {
  switch (intent.kind) {
    case 'tap': {
      const to = cellOf(state, intent.target);
      return to === null ? null : { kind: 'hop', to };
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
 * nothing else, so a finished run (listMoves is empty), water and stones out of reach give null.
 */
export function intentToMove(state: StepstoneState, intent: InputIntent): StepstoneMove | null {
  const move = candidate(state, intent);
  if (move === null) return null;
  return listMoves(state).some((listed) => listed.to === move.to) ? move : null;
}
