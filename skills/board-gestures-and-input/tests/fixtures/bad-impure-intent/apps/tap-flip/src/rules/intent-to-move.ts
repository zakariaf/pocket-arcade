// apps/tap-flip/src/rules/intent-to-move.ts
import { Platform } from 'react-native';

import { listMoves } from './list-moves.ts';

import type { TapFlipMove, TapFlipState } from './tap-flip-types.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';

/** The move a tap points at, before legality: a tapped board cell flips. */
function candidate(intent: InputIntent): TapFlipMove | null {
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
function isSameMove(a: TapFlipMove, b: TapFlipMove): boolean {
  return a.col === b.col && a.row === b.row;
}

/**
 * Pure: an intent becomes a legal move or nothing. Legality is "listMoves(state) lists it" and
 * nothing else, so a finished run (listMoves is empty) and a cell off the grid both give null.
 */
export function intentToMove(
  state: TapFlipState,
  intent: InputIntent,
): TapFlipMove | null {
  const move = candidate(intent);
  if (move === null) return null;
  return listMoves(state).some((listed) => isSameMove(listed, move)) ? move : null;
}
