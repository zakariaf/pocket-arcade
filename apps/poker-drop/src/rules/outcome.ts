// apps/poker-drop/src/rules/outcome.ts
import { COLS, hasRoom } from './well.ts';

import type { PokerDropState } from './poker-drop-types.ts';
import type { Outcome } from '@e07/game-kit/contract/game-engine.ts';

/**
 * The one way of losing (S7: "The well is full"): no column has room for the card in hand, or a
 * rising row pushed a card past the top.
 */
export const WELL_FULL = 'poker-drop.lose.well-full';

/** True when some column can still take a card. */
export function hasAnyRoom(state: PokerDropState): boolean {
  for (let col = 0; col < COLS; col += 1) if (hasRoom(state.cells, col)) return true;
  return false;
}

/**
 * Won once the level's hands are made (score games: the score rates the stars), lost when the
 * well is full, else playing. An endless run (goal 0) is never won.
 */
export function outcome(state: PokerDropState): Outcome {
  if (state.goal > 0 && state.handsMade >= state.goal) return { kind: 'won', score: state.score };
  if (state.hasOverflowed || !hasAnyRoom(state)) return { kind: 'lost', reasonKey: WELL_FULL };
  return { kind: 'playing' };
}
