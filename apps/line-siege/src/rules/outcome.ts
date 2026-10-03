// apps/line-siege/src/rules/outcome.ts
// Line Siege v1, checked in this order: no hearts left is lost ('broke through'); the level's
// whole wave gone is won (never in the endless run); no offered block fitting anywhere is lost
// ('board full'); otherwise playing. A deliberate exception to "won beats lost": a breach of the
// last heart loses even when that monster was the wave's last. A win beats a full board.
import { isEndlessDifficulty } from '@e07/game-kit/contract/difficulty.ts';

import { knobsFor } from './line-siege-tuning.ts';
import { hasAnyMove } from './placement.ts';

import type { LineSiegeState } from './line-siege-types.ts';
import type { Outcome } from '@e07/game-kit/contract/game-engine.ts';

/** The monsters broke through the wall: the last heart is gone. */
export const BROKE_THROUGH_KEY = 'line-siege.lose.broke-through';
/** No offered block fits anywhere on the board. */
export const BOARD_FULL_KEY = 'line-siege.lose.board-full';

/** The level's wave is over: every monster of it has entered and none is left in the lanes. */
export function isWaveOver(state: LineSiegeState): boolean {
  if (isEndlessDifficulty(state.difficulty)) return false;
  return state.spawned >= knobsFor(state.difficulty).goal && state.monsters.length === 0;
}

export function outcome(state: LineSiegeState): Outcome {
  if (state.hearts <= 0) return { kind: 'lost', reasonKey: BROKE_THROUGH_KEY };
  if (isWaveOver(state)) return { kind: 'won', score: state.score };
  return hasAnyMove(state) ? { kind: 'playing' } : { kind: 'lost', reasonKey: BOARD_FULL_KEY };
}
