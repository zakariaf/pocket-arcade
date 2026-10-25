// apps/swap-guard/src/rules/intent-to-move.ts
// Spec 10 BOARD AND CONTROLS: a touch becomes a move or nothing. A tap on a square next to the
// guard swaps with whatever stands there (the engine's panMode is 'none': no pan gesture). Taps are
// physical: the board never mirrors. Legal means "listMoves lists it", nothing else.
import { listMoves } from './list-moves.ts';

import type { SwapGuardMove, SwapGuardState } from './swap-guard-types.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

/** The swap with a tapped board square, when listMoves lists it. */
function swapWith(state: SwapGuardState, target: BoardTarget): SwapGuardMove | null {
  const isOnBoard =
    target.regionId === 'board' &&
    target.col >= 0 &&
    target.row >= 0 &&
    target.col < state.size &&
    target.row < state.size;
  if (!isOnBoard) return null;
  const cell = target.row * state.size + target.col;
  return listMoves(state).find((move) => move.cell === cell) ?? null;
}

/** Pure: a tap becomes a swap the rules allow, or null. */
export function intentToMove(state: SwapGuardState, intent: InputIntent): SwapGuardMove | null {
  switch (intent.kind) {
    case 'tap':
      return swapWith(state, intent.target);
    case 'long-press':
    case 'swipe':
    case 'drag-end':
    case 'aim':
      return null;
  }
}
