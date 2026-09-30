// apps/tile-drop/src/rules/apply-move.ts
import { err, ok, type Result } from '@demo/game-kit/contract/result.ts';

export type GameState = { readonly columns: readonly number[]; readonly score: number };

export type Move = { readonly kind: 'place-block'; readonly column: number };

export type GameEvent =
  | { readonly kind: 'block-placed'; readonly column: number }
  | { readonly kind: 'column-cleared'; readonly column: number };

export type MoveError = { readonly kind: 'column-out-of-range'; readonly column: number };

export type ApplyResult = { readonly state: GameState; readonly events: readonly GameEvent[] };

const COLUMN_HEIGHT = 8;
const CLEAR_BONUS = 10;

/** Applies one move; an illegal move is an expected failure, returned as a value. */
export function applyMove(state: GameState, move: Move): Result<ApplyResult, MoveError> {
  const height = state.columns[move.column];
  if (height === undefined) {
    return err({ kind: 'column-out-of-range', column: move.column });
  }
  const isFull = height + 1 === COLUMN_HEIGHT;
  const nextHeight = isFull ? 0 : height + 1;
  const columns = state.columns.map((value, index) => (index === move.column ? nextHeight : value));
  const events: GameEvent[] = [{ kind: 'block-placed', column: move.column }];
  if (isFull) {
    events.push({ kind: 'column-cleared', column: move.column });
  }
  const score = state.score + (isFull ? CLEAR_BONUS : 1);
  return ok({ state: { columns, score }, events });
}
