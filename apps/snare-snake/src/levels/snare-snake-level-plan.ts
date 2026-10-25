// apps/snare-snake/src/levels/snare-snake-level-plan.ts
// Spec 8.1 and D9: 3 packs x 30 levels, each generated from a seed and a difficulty and proven
// winnable by the witness (snare-snake-solver.ts). Snare Snake is a score game: stars come from
// score thresholds set by the witness's final score ("Score games: 3 / 2 / 1 stars at score
// thresholds"), and par (the witness line's length) is only a filter, never shown.
import { MAX_LEVEL_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { create } from '@e07/snare-snake/rules/create.ts';

import { SNARE_SNAKE_SOLVER, WITNESS_MAX_NODES } from './snare-snake-solver.ts';

import type { LevelPlan } from '@e07/game-kit/levels/level-plan.ts';
import type { SnareSnakeMove, SnareSnakeState } from '@e07/snare-snake/rules/snare-snake-types.ts';

export const LEVELS_PER_PACK = 30;
/** A level the witness wins in fewer moves is over before the snake has to plan a loop. */
export const MIN_WITNESS_MOVES = 6;
const LAST_LEVEL = 3 * LEVELS_PER_PACK;
/** 3 stars: this much above the witness score, in percent (the plan's quality bar). */
const THREE_STAR_MARGIN_PERCENT = 20;

/** 0 at level 1, rising evenly to 99 at the last level; never falls. */
export function difficultyFor(level: number): number {
  const step = Math.min(Math.max(level, 1), LAST_LEVEL) - 1;
  return Math.floor((step * MAX_LEVEL_DIFFICULTY) / (LAST_LEVEL - 1));
}

/**
 * [win, two, three]: catching every critter wins, whatever the score, so thresholds[0] is 0;
 * 2 stars at the witness bot's score (a reasonable player's result, at least 1); 3 stars 20 %
 * above it (at least 1 more).
 */
export function scoreThresholds(witnessScore: number): [number, number, number] {
  const two = Math.max(witnessScore, 1);
  const margin = Math.floor((two * THREE_STAR_MARGIN_PERCENT) / 100);
  return [0, two, two + Math.max(margin, 1)];
}

/** The level table recipe; packages/tooling/src/levels/generate-levels.ts turns it into pack-<n>.json. */
export const SNARE_SNAKE_LEVEL_PLAN: LevelPlan<SnareSnakeState, SnareSnakeMove> = {
  gameId: 'snare-snake',
  packs: [
    { id: 'garden-patch', nameId: 'snare-snake.pack-name.1' },
    { id: 'mossy-rocks', nameId: 'snare-snake.pack-name.2' },
    { id: 'bramble-wood', nameId: 'snare-snake.pack-name.3' },
  ],
  levelsPerPack: LEVELS_PER_PACK,
  difficultyFor,
  create,
  solver: SNARE_SNAKE_SOLVER,
  maxNodes: WITNESS_MAX_NODES,
  // Witness losses are retries: on the hardest row about half the candidates fail first.
  maxTries: 60,
  rate: ({ par, final }) =>
    par < MIN_WITNESS_MOVES ? null : { kind: 'score', thresholds: scoreThresholds(final.score) },
};
