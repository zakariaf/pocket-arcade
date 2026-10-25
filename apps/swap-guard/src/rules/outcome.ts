// apps/swap-guard/src/rules/outcome.ts
import { TUNING } from './swap-guard-tuning.ts';

import type { SwapGuardState } from './swap-guard-types.ts';
import type { Outcome } from '@e07/game-kit/contract/game-engine.ts';

/**
 * A strike on the guard loses the run, even in the volley that knocks out the last enemy.
 * Otherwise the last enemy down wins (also with the last swap of the budget), with 10 points per
 * spare swap; enemies left once the budget is spent lose.
 */
export function outcome(state: SwapGuardState): Outcome {
  if (state.isHit) return { kind: 'lost', reasonKey: 'swap-guard.lose.hit' };
  if (state.enemies.length === 0) {
    const spare = state.maxSwaps - state.swaps;
    return { kind: 'won', score: state.score + spare * TUNING.pointsPerSpareSwap };
  }
  return state.swaps >= state.maxSwaps
    ? { kind: 'lost', reasonKey: 'swap-guard.lose.out-of-swaps' }
    : { kind: 'playing' };
}
