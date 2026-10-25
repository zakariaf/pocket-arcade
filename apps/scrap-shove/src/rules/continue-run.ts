// apps/scrap-shove/src/rules/continue-run.ts
import { outcome } from './outcome.ts';

import type { ScrapShoveResult, ScrapShoveState } from './scrap-shove-types.ts';

/**
 * The one continue (spec 8.10: "the last move is undone"): the floor goes back to how it was
 * before the move that let a robot reach the player, and the player chooses again. Refused (a
 * RangeError) for a run that is not lost or has already continued once.
 */
export function continueRun(lost: ScrapShoveState): ScrapShoveResult {
  if (outcome(lost).kind !== 'lost' || lost.rescue === null || lost.hasContinued) {
    throw new RangeError('no continue for this state');
  }
  const state = { ...lost, ...lost.rescue, caughtBy: null, rescue: null, hasContinued: true };
  return { state, events: [{ kind: 'step-reverted' }] };
}
