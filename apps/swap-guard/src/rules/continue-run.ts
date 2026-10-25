// apps/swap-guard/src/rules/continue-run.ts
// Spec 8.10: the one continue after a loss undoes the last swap. The enemies its volley knocked out
// stand again where they stood, the swapped enemy and the guard swap back, and the swap and its
// points are given back, so the guard chooses again from the square before the loss. Pure, like
// applyMove; a second continue in the same run, or one on a run that is not lost, is refused.
import { outcome } from './outcome.ts';

import type { LastSwap, SwapGuardResult, SwapGuardState } from './swap-guard-types.ts';

/**
 * The board before `last`, as the continue stands it again: the guard back on `from`, the swapped
 * enemy back on `to`, the knocked-out enemies standing where they stood, the swap and its points
 * given back. The continue flag is left as it was (parseState also reads a run back through it).
 */
export function boardBeforeSwap(state: SwapGuardState, last: LastSwap): SwapGuardState {
  const standing = [...state.enemies, ...last.defeated].sort((a, b) => a.id - b.id);
  return {
    ...state,
    guard: last.from,
    enemies: standing.map((enemy) =>
      enemy.cell === last.from ? { ...enemy, cell: last.to } : enemy,
    ),
    swaps: state.swaps - 1,
    score: state.score - last.points,
    isHit: false,
    lastSwap: null,
  };
}

/** rules.continueRun.apply: a lost run made playable again, with the event that explains it. */
export function continueAfterLoss(lost: SwapGuardState): SwapGuardResult {
  const last = lost.lastSwap;
  if (outcome(lost).kind !== 'lost' || last === null || lost.hasContinued) {
    throw new RangeError('no continue: the run is not lost, has no swap to undo or continued once');
  }
  const swapped = [...lost.enemies, ...last.defeated].find((enemy) => enemy.cell === last.from);
  return {
    state: { ...boardBeforeSwap(lost, last), hasContinued: true },
    events: [
      {
        kind: 'swap-reversed',
        from: last.to,
        to: last.from,
        enemyId: swapped === undefined ? null : swapped.id,
        restoredIds: last.defeated.map((enemy) => enemy.id),
      },
    ],
  };
}
