// apps/tap-flip/src/rules/apply-move.ts
import { flipCells, neighbourhood } from './flip-cells.ts';
import { isCleared, outcome } from './outcome.ts';

import type {
  TapFlipEvent,
  TapFlipMove,
  TapFlipResult,
  TapFlipState,
} from './tap-flip-types.ts';

function isLegal(state: TapFlipState, move: TapFlipMove): boolean {
  const isInside = move.col >= 0 && move.col < state.cols && move.row >= 0 && move.row < state.rows;
  return isInside && Number.isInteger(move.col) && Number.isInteger(move.row);
}

/**
 * Pure: the next state plus the events that explain it. An illegal move throws instead of
 * returning a corrupted state (the Shell only ever passes moves listMoves offered).
 */
export function applyMove(
  state: TapFlipState,
  move: TapFlipMove,
): TapFlipResult {
  if (outcome(state).kind !== 'playing' || !isLegal(state, move)) {
    throw new RangeError(`illegal move ${JSON.stringify(move)}`);
  }
  const flipped = neighbourhood(state.cols, state.rows, move.row * state.cols + move.col);
  const next: TapFlipState = {
    ...state,
    cells: flipCells(state.cells, flipped),
    moves: state.moves + 1,
  };
  const events: TapFlipEvent[] = [{ kind: 'cells-flipped', cells: flipped }];
  if (isCleared(next)) events.push({ kind: 'board-cleared' });
  return { state: next, events };
}
