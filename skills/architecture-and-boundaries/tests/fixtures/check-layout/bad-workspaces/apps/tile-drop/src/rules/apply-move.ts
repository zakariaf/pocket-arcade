// apps/tile-drop/src/rules/apply-move.ts
import { ok, type Result } from '@demo/game-kit/contract/result.ts';

import type { GameState } from './game-state.ts';

/** Applies one move. */
export function applyMove(state: GameState): Result<GameState, never> {
  return ok({ score: state.score + 1 });
}
