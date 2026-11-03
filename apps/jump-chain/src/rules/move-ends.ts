// apps/jump-chain/src/rules/move-ends.ts
// The input names a square: a drag's drop square or a tapped square. The move it plays is the
// longest listed chain that ends there (the first listed among equally long ones), or the step onto
// it. The board previews exactly this move while the finger hovers, so what the player sees is what
// is played. A loop chain ends on the piece's own square, where a drop cancels; a drag let go there
// plays a loop only when its traced path passed the loop's landing squares in order (loopAlong).
// Pure, like the rules.
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

/** True when every square of `wanted` appears in `trace`, in order (others may sit between). */
function isTracedIn(wanted: readonly Square[], trace: readonly Square[]): boolean {
  let next = 0;
  for (const square of trace) {
    const want = wanted[next];
    if (want !== undefined && isSameSquare(square, want)) next += 1;
  }
  return next === wanted.length;
}

/**
 * The loop chain (a jump back to the piece's own square) whose landing squares a drag's path passed
 * in order: the longest such chain, the first listed among equally long ones; null when the path
 * traced no loop (a drag back on the piece is then a cancel).
 */
export function loopAlong(state: JumpChainState, path: readonly Square[]): JumpChainMove | null {
  let best: JumpChainMove | null = null;
  for (const move of listMoves(state)) {
    if (move.kind !== 'jump' || !isSameSquare(endOf(move), state.piece)) continue;
    const isLonger = best === null || lengthOf(move) > lengthOf(best);
    if (isLonger && isTracedIn(move.path, path)) best = move;
  }
  return best;
}
