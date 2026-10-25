// apps/jump-chain/src/rules/intent-to-move.ts
// The input names a square, not a path: the gesture layer reports where a drag of the piece was let
// go, or which square was tapped, and the move that ends there is played (move-ends.ts). A drag let
// go back on the piece's own square cancels: there is no undo, so that is how a drag is taken back
// (the drag-end intent carries no path, so a loop chain that returns there cannot be told from a
// change of mind, and is not offered). Pure: no gesture code here, and legality is "listMoves lists
// it", nothing else.
import { isSameSquare } from './board-squares.ts';
import { moveEndingAt } from './move-ends.ts';

import type { JumpChainMove, JumpChainState, Square } from './jump-chain-types.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

function boardSquare(target: BoardTarget | null): Square | null {
  return target?.regionId === 'board' ? { col: target.col, row: target.row } : null;
}

/** A board square other than the piece's own: touching or dropping back on the piece is no move. */
function awayFromPiece(state: JumpChainState, square: Square | null): Square | null {
  return square === null || isSameSquare(square, state.piece) ? null : square;
}

/** The square the player chose for the move to end on, before legality. */
function chosenSquare(state: JumpChainState, intent: InputIntent): Square | null {
  switch (intent.kind) {
    case 'tap':
      return awayFromPiece(state, boardSquare(intent.target));
    case 'drag-end': {
      const from = boardSquare(intent.from);
      const isFromPiece = from !== null && isSameSquare(from, state.piece);
      return isFromPiece ? awayFromPiece(state, boardSquare(intent.to)) : null;
    }
    case 'long-press':
    case 'swipe':
    case 'aim':
      return null;
  }
}

/** Pure: an intent becomes the listed move that ends on the chosen square, or nothing. */
export function intentToMove(state: JumpChainState, intent: InputIntent): JumpChainMove | null {
  const square = chosenSquare(state, intent);
  return square === null ? null : moveEndingAt(state, square);
}
