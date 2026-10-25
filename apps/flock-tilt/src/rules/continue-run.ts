// apps/flock-tilt/src/rules/continue-run.ts
// Spec 8.10: the one continue after a loss. The tilt that ended the run is taken back (the lost
// sheep is back on the field, every animal where it stood) and the run gets continueTilts more
// tilts, so a run that ran out of tilts can go on too. Pure, like applyMove; one per run.
import { TUNING } from './flock-tilt-tuning.ts';

import type { FlockTiltResult, FlockTiltState } from './flock-tilt-types.ts';

/** rules.continueRun.apply: a lost run made playable again, with the event that explains it. */
export function continueAfterLoss(lost: FlockTiltState): FlockTiltResult {
  const before = lost.beforeLoss;
  if (before === null || lost.hasContinued) {
    throw new RangeError('no continue: the run is not lost, or its one continue was used');
  }
  const state: FlockTiltState = {
    ...lost,
    sheep: before.sheep,
    wolves: before.wolves,
    tilts: before.tilts,
    tiltLimit: lost.tiltLimit + TUNING.continueTilts,
    hasContinued: true,
    beforeLoss: null,
  };
  return { state, events: [{ kind: 'tilt-taken-back', tiltsAdded: TUNING.continueTilts }] };
}
