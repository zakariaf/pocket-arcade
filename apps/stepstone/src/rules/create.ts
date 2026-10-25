// apps/stepstone/src/rules/create.ts
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { layPond } from './lay-pond.ts';
import { TUNING, knobsFor } from './stepstone-tuning.ts';

import type { StepstoneState } from './stepstone-types.ts';

/**
 * Start state from (seed, difficulty): the same pair gives the same pond on every phone (spec 8.1).
 * Ponds are laid until one needs at least the row's minPar hops (at most layAttempts tries; the
 * longest so far is kept), so no level is a hop or two from the start.
 */
export function create(seed: number, difficulty: number): StepstoneState {
  const knobs = knobsFor(difficulty);
  let laid = layPond(knobs, seedRng(seed));
  let best = laid.state;
  for (let attempt = 1; attempt < TUNING.layAttempts && best.par < knobs.minPar; attempt += 1) {
    laid = layPond(knobs, laid.rng);
    if (laid.state.par > best.par) best = laid.state;
  }
  return best;
}
