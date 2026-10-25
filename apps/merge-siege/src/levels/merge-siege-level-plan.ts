// apps/merge-siege/src/levels/merge-siege-level-plan.ts
// Spec 8.1 and D9: 3 packs x 30 levels, each generated from a seed and a difficulty and proven
// winnable by the witness (merge-siege-solver.ts). Merge Siege is a score game: stars come from
// score thresholds set by the witness's final score, and par (the witness line's length) is only a
// filter against levels that are over before the siege starts.
import { MAX_LEVEL_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { create } from '@e07/merge-siege/rules/create.ts';

import { MERGE_SIEGE_SOLVER, WITNESS_MAX_NODES } from './merge-siege-solver.ts';

import type { LevelPlan } from '@e07/game-kit/levels/level-plan.ts';
import type { MergeSiegeMove, MergeSiegeState } from '@e07/merge-siege/rules/merge-siege-types.ts';

export const LEVELS_PER_PACK = 30;
/** A level the witness wins in fewer swipes is over before the enemies march at all. */
export const MIN_WITNESS_SWIPES = 6;
const LAST_LEVEL = 3 * LEVELS_PER_PACK;
/** 3 stars: this much above the witness score, in percent (the plan's quality bar). */
const THREE_STAR_MARGIN_PERCENT = 20;

/** 0 at level 1, rising evenly to 99 at the last level (100 is the endless run); never falls. */
export function difficultyFor(level: number): number {
  const step = Math.min(Math.max(level, 1), LAST_LEVEL) - 1;
  return Math.floor((step * MAX_LEVEL_DIFFICULTY) / (LAST_LEVEL - 1));
}

/**
 * [win, two, three]: smashing the wave wins, whatever the score, so thresholds[0] is 0; 2 stars at
 * the witness bot's score (a reasonable player's result, at least 1); 3 stars 20 % above it (at
 * least 1 more).
 */
export function scoreThresholds(witnessScore: number): [number, number, number] {
  const two = Math.max(witnessScore, 1);
  const margin = Math.floor((two * THREE_STAR_MARGIN_PERCENT) / 100);
  return [0, two, two + Math.max(margin, 1)];
}

/** The level table recipe; packages/tooling/src/levels/generate-levels.ts turns it into pack-<n>.json. */
export const MERGE_SIEGE_LEVEL_PLAN: LevelPlan<MergeSiegeState, MergeSiegeMove> = {
  gameId: 'merge-siege',
  packs: [
    { id: 'outer-gate', nameId: 'merge-siege.pack-name.1' },
    { id: 'inner-wall', nameId: 'merge-siege.pack-name.2' },
    { id: 'grand-keep', nameId: 'merge-siege.pack-name.3' },
  ],
  levelsPerPack: LEVELS_PER_PACK,
  difficultyFor,
  create,
  solver: MERGE_SIEGE_SOLVER,
  maxNodes: WITNESS_MAX_NODES,
  // Witness losses are retries: in the hardest row about five candidates in six are lost.
  maxTries: 60,
  rate: ({ par, final }) =>
    par < MIN_WITNESS_SWIPES ? null : { kind: 'score', thresholds: scoreThresholds(final.score) },
};
