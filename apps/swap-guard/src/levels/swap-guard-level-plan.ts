// apps/swap-guard/src/levels/swap-guard-level-plan.ts
import { create } from '@e07/swap-guard/rules/create.ts';

import { randomWins } from './swap-guard-random-play.ts';
import { SWAP_GUARD_SOLVER } from './swap-guard-solver.ts';

import type { LevelPlan } from '@e07/game-kit/levels/level-plan.ts';
import type { SwapGuardMove, SwapGuardState } from '@e07/swap-guard/rules/swap-guard-types.ts';

export const LEVELS_PER_PACK = 30;
const PACK_COUNT = 3;
/** Difficulties per tuning row (four rows on 0..99: 0-24, 25-49, 50-74, 75-99). */
const ROW_SPAN = 25;
/**
 * The top of this game's curve: the last level plays the top of the third row (6 x 6, five
 * enemies with brutes). The fourth row (six enemies) is left to the sims: its starts cost the
 * exact solver over 400,000 positions in a third of the seeds, too much to prove a table with.
 */
export const LEVEL_DIFFICULTY_CAP = PACK_COUNT * ROW_SPAN - 1;
/** Random runs per candidate; a level the random player wins more than MAX_RANDOM_WINS of is out. */
export const RANDOM_RUNS = 20;
export const MAX_RANDOM_WINS = 1;
/** Fewest swaps a level of each pack must need (pars measured: 3-7, 6-10, 9-14). */
const MIN_PAR_BY_PACK = [3, 5, 8] as const;

function packIndexOf(level: number): number {
  const clamped = Math.min(Math.max(level, 1), PACK_COUNT * LEVELS_PER_PACK);
  return Math.floor((clamped - 1) / LEVELS_PER_PACK);
}

/**
 * One tuning row per pack, rising evenly through it: pack n spans difficulties 25(n-1) to
 * 25(n-1) + 24, so 0 at level 1 and 74 at level 90; never falls.
 */
export function difficultyFor(level: number): number {
  const clamped = Math.min(Math.max(level, 1), PACK_COUNT * LEVELS_PER_PACK);
  const pack = packIndexOf(clamped);
  const step = clamped - 1 - pack * LEVELS_PER_PACK;
  return pack * ROW_SPAN + Math.floor((step * (ROW_SPAN - 1)) / (LEVELS_PER_PACK - 1));
}

/** Fewest swaps a level of this pack must need: 3, 5, then 8 (no trivial levels). */
export function minParFor(level: number): number {
  return MIN_PAR_BY_PACK.reduce((picked, par, index) =>
    index === packIndexOf(level) ? par : picked,
  );
}

/**
 * The level table recipe. packages/tooling/src/levels/generate-levels.ts turns it into
 * pack-<n>.json: run the generator, commit the packs it writes (never copy or edit packs).
 */
export const SWAP_GUARD_LEVEL_PLAN: LevelPlan<SwapGuardState, SwapGuardMove> = {
  gameId: 'swap-guard',
  packs: [
    { id: 'gatehouse', nameId: 'swap-guard.pack-name.1' },
    { id: 'courtyard', nameId: 'swap-guard.pack-name.2' },
    { id: 'throne-room', nameId: 'swap-guard.pack-name.3' },
  ],
  levelsPerPack: LEVELS_PER_PACK,
  difficultyFor,
  create,
  solver: SWAP_GUARD_SOLVER,
  maxNodes: 30_000,
  maxTries: 60,
  rate: ({ level, seed, start, par }) =>
    par >= minParFor(level) && randomWins(start, seed, RANDOM_RUNS) <= MAX_RANDOM_WINS
      ? { kind: 'par', par }
      : null,
};
