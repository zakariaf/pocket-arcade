// apps/swap-guard/src/rules/continue-run.ts
// Spec 8.10: the one continue after a loss undoes the last swap. The enemies its volley knocked out
// stand again where they stood, the swapped enemy and the guard swap back, and the swap and its
// points are given back, so the guard chooses again from the square before the loss. Pure, like
// applyMove; a second continue in the same run, or one on a run that is not lost, is refused.
import { outcome } from './outcome.ts';

import type { SwapGuardResult, SwapGuardState } from './swap-guard-types.ts';

/** rules.continueRun.apply: a lost run made playable again, with the event that explains it. */
export function continueAfterLoss(lost: SwapGuardState): SwapGuardResult {
  const last = lost.lastSwap;
  if (outcome(lost).kind !== 'lost' || last === null || lost.hasContinued) {
    throw new RangeError('no continue: the run is not lost, has no swap to undo or continued once');
  }
  const standing = [...lost.enemies, ...last.defeated].sort((a, b) => a.id - b.id);
  const swapped = standing.find((enemy) => enemy.cell === last.from);
  const enemies = standing.map((enemy) =>
    enemy.cell === last.from ? { ...enemy, cell: last.to } : enemy,
  );
  return {
    state: {
      ...lost,
      guard: last.from,
      enemies,
      swaps: lost.swaps - 1,
      score: lost.score - last.points,
      isHit: false,
      lastSwap: null,
      hasContinued: true,
    },
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
