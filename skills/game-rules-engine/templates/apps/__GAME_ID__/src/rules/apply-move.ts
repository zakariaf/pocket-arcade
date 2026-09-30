// apps/__GAME_ID__/src/rules/apply-move.ts
import { flipCells, neighbourhood } from './flip-cells.ts';
import { isCleared, outcome } from './outcome.ts';

import type {
  __GAME_PASCAL__Event,
  __GAME_PASCAL__Move,
  __GAME_PASCAL__Result,
  __GAME_PASCAL__State,
} from './__GAME_ID__-types.ts';

function isLegal(state: __GAME_PASCAL__State, move: __GAME_PASCAL__Move): boolean {
  const isInside = move.col >= 0 && move.col < state.cols && move.row >= 0 && move.row < state.rows;
  return isInside && Number.isInteger(move.col) && Number.isInteger(move.row);
}

/**
 * Pure: the next state plus the events that explain it. An illegal move throws instead of
 * returning a corrupted state (the Shell only ever passes moves listMoves offered).
 */
export function applyMove(
  state: __GAME_PASCAL__State,
  move: __GAME_PASCAL__Move,
): __GAME_PASCAL__Result {
  if (outcome(state).kind !== 'playing' || !isLegal(state, move)) {
    throw new RangeError(`illegal move ${JSON.stringify(move)}`);
  }
  const flipped = neighbourhood(state.cols, state.rows, move.row * state.cols + move.col);
  const next: __GAME_PASCAL__State = {
    ...state,
    cells: flipCells(state.cells, flipped),
    moves: state.moves + 1,
  };
  const events: __GAME_PASCAL__Event[] = [{ kind: 'cells-flipped', cells: flipped }];
  if (isCleared(next)) events.push({ kind: 'board-cleared' });
  return { state: next, events };
}
