// apps/flock-tilt/src/levels/flock-tilt-level-plan.ts
import { applyMove } from '@e07/flock-tilt/rules/apply-move.ts';
import { create } from '@e07/flock-tilt/rules/create.ts';
import { listMoves } from '@e07/flock-tilt/rules/list-moves.ts';
import { outcome } from '@e07/flock-tilt/rules/outcome.ts';
import { MAX_LEVEL_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { nextInt, seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { FLOCK_TILT_SOLVER } from './flock-tilt-solver.ts';

import type { FlockTiltMove, FlockTiltState } from '@e07/flock-tilt/rules/flock-tilt-types.ts';
import type { LevelPlan } from '@e07/game-kit/levels/level-plan.ts';

export const LEVELS_PER_PACK = 30;
const LAST_LEVEL = 3 * LEVELS_PER_PACK;
/** Seeded random swipers tried on each candidate field ("naive bots should lose"). */
export const RANDOM_TRIALS = 24;
/** A field more random swipers than this share win within twice par plus two is rejected. */
export const MAX_RANDOM_WIN_SHARE = 0.25;

/** 0 at level 1, rising evenly to 99 at level 90; never falls. */
export function difficultyFor(level: number): number {
  const step = Math.min(Math.max(level, 1), LAST_LEVEL) - 1;
  return Math.floor((step * MAX_LEVEL_DIFFICULTY) / (LAST_LEVEL - 1));
}

/** Fewest tilts a level of this pack must need: 3, 4, then 5 (no trivial level). */
export function minParFor(level: number): number {
  return 3 + Math.floor((Math.min(Math.max(level, 1), LAST_LEVEL) - 1) / LEVELS_PER_PACK);
}

/** One seeded random swiper: does it win within `cap` tilts? */
function randomWins(start: FlockTiltState, seed: number, cap: number): boolean {
  let state = start;
  let rng = seedRng(seed);
  for (let tilt = 0; tilt < cap && outcome(state).kind === 'playing'; tilt += 1) {
    const moves = listMoves(state);
    const draw = nextInt(rng, moves.length);
    rng = draw.state;
    state = applyMove(state, pickAt(moves, draw.value)).state;
  }
  return outcome(state).kind === 'won';
}

/** Share of RANDOM_TRIALS seeded random swipers that win within twice par plus two tilts. */
export function randomWinShare(start: FlockTiltState, par: number): number {
  const cap = 2 * par + 2;
  let wins = 0;
  for (let trial = 1; trial <= RANDOM_TRIALS; trial += 1) {
    if (randomWins(start, trial, cap)) wins += 1;
  }
  return wins / RANDOM_TRIALS;
}

/**
 * The level table recipe. packages/tooling/src/levels/generate-levels.ts turns it into
 * pack-<n>.json: copy the plan, run the generator, commit the packs it writes (never copy packs).
 */
export const FLOCK_TILT_LEVEL_PLAN: LevelPlan<FlockTiltState, FlockTiltMove> = {
  gameId: 'flock-tilt',
  packs: [
    { id: 'green-meadow', nameId: 'flock-tilt.pack-name.1' },
    { id: 'rocky-hills', nameId: 'flock-tilt.pack-name.2' },
    { id: 'wolf-country', nameId: 'flock-tilt.pack-name.3' },
  ],
  levelsPerPack: LEVELS_PER_PACK,
  difficultyFor,
  create,
  solver: FLOCK_TILT_SOLVER,
  maxNodes: 60_000,
  maxTries: 60,
  rate: ({ level, par, start }) =>
    par >= minParFor(level) && randomWinShare(start, par) <= MAX_RANDOM_WIN_SHARE
      ? { kind: 'par', par }
      : null,
};
