// apps/trail-clear/src/levels/trail-clear-level-plan.ts
// Spec 8.1 and D9: 3 packs x 30 levels, each generated from a seed and a difficulty and proven
// winnable by the witness (trail-clear-solver.ts). Trail Clear is a score game: a level is won by
// placing the last tile of its bag, whatever the score, and the stars come from score thresholds
// set by the witness's final score.
import { MAX_LEVEL_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { create } from '@e07/trail-clear/rules/create.ts';

import { TRAIL_CLEAR_SOLVER, WITNESS_MAX_NODES } from './trail-clear-solver.ts';

import type { LevelPlan } from '@e07/game-kit/levels/level-plan.ts';
import type { TrailClearMove, TrailClearState } from '@e07/trail-clear/rules/trail-clear-types.ts';

export const LEVELS_PER_PACK = 30;
/** A level whose witness closes fewer loops than this is a bag of tiles, not a puzzle. */
export const MIN_WITNESS_LOOPS = 4;
const LAST_LEVEL = 3 * LEVELS_PER_PACK;
/** 3 stars: this much above the witness score, in percent (the plan's quality bar). */
const THREE_STAR_MARGIN_PERCENT = 20;

/** 0 at level 1, rising evenly to 99 at the last level (100 is the endless run); never falls. */
export function difficultyFor(level: number): number {
  const step = Math.min(Math.max(level, 1), LAST_LEVEL) - 1;
  return Math.floor((step * MAX_LEVEL_DIFFICULTY) / (LAST_LEVEL - 1));
}

/**
 * [win, two, three]: placing the last tile wins, whatever the score, so thresholds[0] is 0; 2 stars
 * at the witness bot's score (a reasonable player's result, at least 1); 3 stars 20 % above it (at
 * least 1 more).
 */
export function scoreThresholds(witnessScore: number): [number, number, number] {
  const two = Math.max(witnessScore, 1);
  const margin = Math.floor((two * THREE_STAR_MARGIN_PERCENT) / 100);
  return [0, two, two + Math.max(margin, 1)];
}

/** The level table recipe; packages/tooling/src/levels/generate-levels.ts turns it into pack-<n>.json. */
export const TRAIL_CLEAR_LEVEL_PLAN: LevelPlan<TrailClearState, TrailClearMove> = {
  gameId: 'trail-clear',
  packs: [
    { id: 'country-lanes', nameId: 'trail-clear.pack-name.1' },
    { id: 'river-bends', nameId: 'trail-clear.pack-name.2' },
    { id: 'crossroads', nameId: 'trail-clear.pack-name.3' },
  ],
  levelsPerPack: LEVELS_PER_PACK,
  difficultyFor,
  create,
  solver: TRAIL_CLEAR_SOLVER,
  maxNodes: WITNESS_MAX_NODES,
  // Witness losses are retries: on the hardest row about three candidates in four fail.
  maxTries: 60,
  rate: ({ final }) =>
    final.loopsClosed < MIN_WITNESS_LOOPS
      ? null
      : { kind: 'score', thresholds: scoreThresholds(final.score) },
};
