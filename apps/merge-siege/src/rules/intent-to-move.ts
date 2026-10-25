// apps/merge-siege/src/rules/intent-to-move.ts
// Merge Siege is played with a 4-way swipe (engine.panMode 'swipe'). One finger and no gesture
// works too, as in the toy: a tap slides the tiles toward the side of the board it lands on (the
// nearer of the two axes, measured from the board's centre, the vertical one on a tie), and a tap
// on the gate above the board slides them up. Directions are physical: the board never mirrors.
import { COLS, ROWS } from './board-cells.ts';
import { listMoves } from './list-moves.ts';

import type { MergeSiegeMove, MergeSiegeState } from './merge-siege-types.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type { SwipeDirection } from '@e07/game-kit/geom/classify-swipe.ts';

/** The side a tapped cell is nearest: offsets from the centre in board widths and heights. */
function sideOf(target: BoardTarget): SwipeDirection | null {
  if (target.regionId === 'gate') return 'up';
  if (target.regionId !== 'board') return null;
  const dx = (target.col + 0.5) / COLS - 0.5;
  const dy = (target.row + 0.5) / ROWS - 0.5;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

/** The swipe an intent stands for, before legality. */
function directionOf(intent: InputIntent): SwipeDirection | null {
  switch (intent.kind) {
    case 'swipe':
      return intent.direction;
    case 'tap':
      return sideOf(intent.target);
    case 'long-press':
    case 'drag-end':
    case 'aim':
      return null;
  }
}

/**
 * Pure: an intent becomes a legal move or nothing. Legality is "listMoves(state) lists it" and
 * nothing else, so a swipe that would move nothing and a finished run both give null.
 */
export function intentToMove(state: MergeSiegeState, intent: InputIntent): MergeSiegeMove | null {
  const direction = directionOf(intent);
  if (direction === null) return null;
  return listMoves(state).find((move) => move.direction === direction) ?? null;
}
