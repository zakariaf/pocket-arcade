// apps/flock-tilt/src/rules/outcome.ts
import { fieldStatus } from './field-status.ts';
import { TUNING } from './flock-tilt-tuning.ts';

import type { FlockTiltState } from './flock-tilt-types.ts';
import type { Outcome } from '@e07/game-kit/contract/game-engine.ts';

/** One catalog key per way of losing (spec S7: a short, friendly reason). */
const LOSE_KEYS = {
  'wolf-got-sheep': 'flock-tilt.lose.wolf-got-sheep',
  'out-of-tilts': 'flock-tilt.lose.out-of-tilts',
} as const;

/** The win's score: every sheep penned, plus the tilts left of the first budget. */
export function winScore(state: FlockTiltState): number {
  const spare = Math.max(0, TUNING.tiltLimit - state.tilts);
  return state.sheep.length * TUNING.pointsPerSheep + spare * TUNING.pointsPerSpareTilt;
}

/** The score the top bar shows while playing and the result shows at the end. */
export function runScore(state: FlockTiltState): number {
  const penned = state.sheep.filter((sheep) => sheep.status === 'penned').length;
  return penned === state.sheep.length ? winScore(state) : penned * TUNING.pointsPerSheep;
}

/** Won beats lost: the last sheep can drop in on the last tilt of the budget. */
export function outcome(state: FlockTiltState): Outcome {
  const status = fieldStatus(state);
  if (status === 'playing') return { kind: 'playing' };
  if (status === 'won') return { kind: 'won', score: winScore(state) };
  return { kind: 'lost', reasonKey: LOSE_KEYS[status] };
}
