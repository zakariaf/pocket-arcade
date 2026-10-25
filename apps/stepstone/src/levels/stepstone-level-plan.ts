// apps/stepstone/src/levels/stepstone-level-plan.ts
import { MAX_LEVEL_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { nextInt, seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { applyMove } from '@e07/stepstone/rules/apply-move.ts';
import { create } from '@e07/stepstone/rules/create.ts';
import { listMoves } from '@e07/stepstone/rules/list-moves.ts';
import { outcome } from '@e07/stepstone/rules/outcome.ts';
import { knobsFor } from '@e07/stepstone/rules/stepstone-tuning.ts';

import { STEPSTONE_SOLVER } from './stepstone-solver.ts';

import type { LevelPlan } from '@e07/game-kit/levels/level-plan.ts';
import type { StepstoneMove, StepstoneState } from '@e07/stepstone/rules/stepstone-types.ts';

export const LEVELS_PER_PACK = 30;
const LAST_LEVEL = 3 * LEVELS_PER_PACK;
/** Random players tried on every candidate pond: the same seeded 16 for every level. */
export const RANDOM_WALKS = 16;
/** A pond more random players cross is rejected: tapping at random strands at least 1 in 4. */
export const MAX_RANDOM_CROSSINGS = 12;

/** 0 at level 1, rising evenly to 99 at the last level; never falls (spec 8.1). */
export function difficultyFor(level: number): number {
  const step = Math.min(Math.max(level, 1), LAST_LEVEL) - 1;
  return Math.floor((step * MAX_LEVEL_DIFFICULTY) / (LAST_LEVEL - 1));
}

/**
 * Fewest hops a level must need: its tuning row's minPar (3, 4, 5, then 6 hops), above the
 * 2, 3 and 4 per pack a puzzle plan asks at least, so no level is a hop or two from the start.
 */
export function minParFor(level: number): number {
  return knobsFor(difficultyFor(level)).minPar;
}

/** One seeded random player from the start: true when it reaches the flag before it is stranded. */
function crosses(start: StepstoneState, walk: number): boolean {
  let state = start;
  let rng = seedRng(walk);
  let moves = listMoves(state);
  while (moves.length > 0) {
    const draw = nextInt(rng, moves.length);
    rng = draw.state;
    state = applyMove(state, pickAt(moves, draw.value)).state;
    moves = listMoves(state);
  }
  return outcome(state).kind === 'won';
}

/** How many of the RANDOM_WALKS seeded random players cross the pond (naive play should strand). */
export function randomCrossings(start: StepstoneState): number {
  const walks = Array.from({ length: RANDOM_WALKS }, (_, index) => index + 1);
  return walks.filter((walk) => crosses(start, walk)).length;
}

/**
 * The level table recipe. packages/tooling/src/levels/generate-levels.ts turns it into
 * pack-<n>.json: copy the plan, run the generator, commit the packs it writes (never copy packs).
 * A level is kept when it needs at least its minimum hops and random tapping does not cross it
 * too often; its stars come from par (spec 8.1).
 */
export const STEPSTONE_LEVEL_PLAN: LevelPlan<StepstoneState, StepstoneMove> = {
  gameId: 'stepstone',
  packs: [
    { id: 'lily-pond', nameId: 'stepstone.pack-name.1' },
    { id: 'misty-creek', nameId: 'stepstone.pack-name.2' },
    { id: 'river-rapids', nameId: 'stepstone.pack-name.3' },
  ],
  levelsPerPack: LEVELS_PER_PACK,
  difficultyFor,
  create,
  solver: STEPSTONE_SOLVER,
  maxNodes: 2_000,
  maxTries: 50,
  rate: ({ level, start, par }) =>
    par >= minParFor(level) && randomCrossings(start) <= MAX_RANDOM_CROSSINGS
      ? { kind: 'par', par }
      : null,
};
