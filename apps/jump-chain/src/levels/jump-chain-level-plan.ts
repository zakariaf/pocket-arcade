// apps/jump-chain/src/levels/jump-chain-level-plan.ts
// Spec 8.1 and D9: 3 packs x 30 levels, each generated from a seed and a difficulty and proven
// winnable by the witness (jump-chain-solver.ts). Jump Chain is a score game: stars come from score
// thresholds set by the witness's final score, and par (the witness line's length) is only a filter.
import { MAX_LEVEL_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { create } from '@e07/jump-chain/rules/create.ts';

import { JUMP_CHAIN_SOLVER, WITNESS_MAX_NODES } from './jump-chain-solver.ts';

import type { LevelPlan } from '@e07/game-kit/levels/level-plan.ts';
import type { JumpChainMove, JumpChainState } from '@e07/jump-chain/rules/jump-chain-types.ts';

export const LEVELS_PER_PACK = 30;
/** A level the witness wins in fewer moves is over before the ranks have marched once. */
export const MIN_WITNESS_MOVES = 5;
const LAST_LEVEL = 3 * LEVELS_PER_PACK;
/** 3 stars: this much above the witness score, in percent (the plan's quality bar). */
const THREE_STAR_MARGIN_PERCENT = 20;

/** 0 at level 1, rising evenly to 99 at the last level (100 is the endless run); never falls. */
export function difficultyFor(level: number): number {
  const step = Math.min(Math.max(level, 1), LAST_LEVEL) - 1;
  return Math.floor((step * MAX_LEVEL_DIFFICULTY) / (LAST_LEVEL - 1));
}

/**
 * [win, two, three]: capturing every enemy wins, whatever the score, so thresholds[0] is 0; 2 stars
 * at the witness bot's score (a reasonable player's result, at least 1); 3 stars 20 % above it (at
 * least 1 more): longer chains than the witness made.
 */
export function scoreThresholds(witnessScore: number): [number, number, number] {
  const two = Math.max(witnessScore, 1);
  const margin = Math.floor((two * THREE_STAR_MARGIN_PERCENT) / 100);
  return [0, two, two + Math.max(margin, 1)];
}

/** The level table recipe; packages/tooling/src/levels/generate-levels.ts turns it into pack-<n>.json. */
export const JUMP_CHAIN_LEVEL_PLAN: LevelPlan<JumpChainState, JumpChainMove> = {
  gameId: 'jump-chain',
  packs: [
    { id: 'opening-moves', nameId: 'jump-chain.pack-name.1' },
    { id: 'middle-game', nameId: 'jump-chain.pack-name.2' },
    { id: 'endgame', nameId: 'jump-chain.pack-name.3' },
  ],
  levelsPerPack: LEVELS_PER_PACK,
  difficultyFor,
  create,
  solver: JUMP_CHAIN_SOLVER,
  maxNodes: WITNESS_MAX_NODES,
  // Witness losses are retries: on the hardest row the witness wins about a third of the seeds.
  maxTries: 60,
  rate: ({ par, final }) =>
    par < MIN_WITNESS_MOVES ? null : { kind: 'score', thresholds: scoreThresholds(final.score) },
};
