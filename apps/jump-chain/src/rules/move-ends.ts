// apps/jump-chain/src/rules/move-ends.ts
// The input names a square, not a path: a drag's drop square or a tapped square. The move it plays
// is the longest listed chain that ends there (the first listed among equally long ones), or the
// step onto it. The board previews exactly this move while the finger hovers, so what the player
// sees is what is played. Pure, like the rules.
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';

import { isSameSquare } from './board-squares.ts';
import { listMoves } from './list-moves.ts';

import type { JumpChainMove, JumpChainState, Square } from './jump-chain-types.ts';

/** A square some listed move ends on, with the move a finger there plays. */
export type MoveEnd = { readonly square: Square; readonly move: JumpChainMove };

function endOf(move: JumpChainMove): Square {
  return move.kind === 'step' ? move.to : pickAt(move.path, move.path.length - 1);
}

function lengthOf(move: JumpChainMove): number {
  return move.kind === 'step' ? 0 : move.path.length;
}

/** Every end square once, in the order its first move is listed, each with the move it plays. */
export function movesByEnd(state: JumpChainState): readonly MoveEnd[] {
  const ends: MoveEnd[] = [];
  for (const move of listMoves(state)) {
    const square = endOf(move);
    const at = ends.findIndex((end) => isSameSquare(end.square, square));
    const current = ends[at];
    if (current === undefined) ends.push({ square, move });
    else if (lengthOf(move) > lengthOf(current.move)) ends[at] = { square, move };
  }
  return ends;
}

/** The move a finger on `square` plays, or null when no listed move ends there. */
export function moveEndingAt(state: JumpChainState, square: Square): JumpChainMove | null {
  return movesByEnd(state).find((end) => isSameSquare(end.square, square))?.move ?? null;
}
