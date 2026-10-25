// apps/jump-chain/src/rules/outcome.ts
// Jump Chain v1, checked in this order: an enemy on your side's row is lost (the ranks overran
// you); a level with no enemy left (none on the board, none waiting) is won with its score; the
// endless run (difficulty 100) is never won; otherwise playing.
import { isEndlessDifficulty } from '@e07/game-kit/contract/difficulty.ts';

import { SIDE_ROW } from './board-squares.ts';

import type { JumpChainState } from './jump-chain-types.ts';
import type { Outcome } from '@e07/game-kit/contract/game-engine.ts';

/** The enemy ranks reached your side. */
export const OVERRUN_KEY = 'jump-chain.lose.overrun';

/** Every enemy of a level is captured (never in the endless run). */
export function isLevelCleared(state: JumpChainState): boolean {
  return !isEndlessDifficulty(state.difficulty) && state.enemies.length === 0;
}

export function outcome(state: JumpChainState): Outcome {
  if (state.enemies.some((enemy) => enemy.row >= SIDE_ROW)) {
    return { kind: 'lost', reasonKey: OVERRUN_KEY };
  }
  return isLevelCleared(state) ? { kind: 'won', score: state.score } : { kind: 'playing' };
}
