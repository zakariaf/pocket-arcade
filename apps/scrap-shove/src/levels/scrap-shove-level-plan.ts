// apps/scrap-shove/src/levels/scrap-shove-level-plan.ts
import { MAX_LEVEL_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { playBot, randomPolicy } from '@e07/game-kit/testing/play-bot.ts';
import { applyMove } from '@e07/scrap-shove/rules/apply-move.ts';
import { create } from '@e07/scrap-shove/rules/create.ts';
import { listMoves } from '@e07/scrap-shove/rules/list-moves.ts';
import { outcome } from '@e07/scrap-shove/rules/outcome.ts';

import { SCRAP_SHOVE_SOLVER } from './scrap-shove-solver.ts';

import type { LevelPlan } from '@e07/game-kit/levels/level-plan.ts';
import type { ScrapShoveMove, ScrapShoveState } from '@e07/scrap-shove/rules/scrap-shove-types.ts';

export const LEVELS_PER_PACK = 30;
/** The top of the curve: the last level plays the hardest row (every floor is proven winnable). */
export const LEVEL_DIFFICULTY_CAP = MAX_LEVEL_DIFFICULTY;
const LAST_LEVEL = 3 * LEVELS_PER_PACK;
/** Random games played on a candidate; it is rejected when random taps win more than one. */
export const RANDOM_TRIES = 6;
const RANDOM_WINS_ALLOWED = 1;
/** Moves a random game may take (floors end long before: a robot or a win). */
const RANDOM_MAX_MOVES = 200;

/** 0 at level 1, rising evenly to LEVEL_DIFFICULTY_CAP at the last level; never falls. */
export function difficultyFor(level: number): number {
  const step = Math.min(Math.max(level, 1), LAST_LEVEL) - 1;
  return Math.floor((step * LEVEL_DIFFICULTY_CAP) / (LAST_LEVEL - 1));
}

/** Fewest moves a level of this pack must need: 2, 3, then 4 (no trivial levels later). */
export function minParFor(level: number): number {
  return 2 + Math.floor((level - 1) / LEVELS_PER_PACK);
}

/**
 * Random-tap wins out of RANDOM_TRIES games on this very floor, each with its own random taps
 * (spec 13 research: "naive bots should lose").
 */
export function randomWins(start: ScrapShoveState): number {
  const game = { create: () => start, listMoves, applyMove, outcome };
  const games = Array.from({ length: RANDOM_TRIES }, (_, index) =>
    playBot(game, {
      seed: index + 1,
      difficulty: 0,
      policy: randomPolicy<ScrapShoveState, ScrapShoveMove>(),
      maxMoves: RANDOM_MAX_MOVES,
    }),
  );
  return games.filter((run) => run.outcome.kind === 'won').length;
}

/**
 * The level table recipe. packages/tooling/src/levels/generate-levels.ts turns it into
 * pack-<n>.json: copy the plan, run the generator, commit the packs it writes (never copy packs).
 */
export const SCRAP_SHOVE_LEVEL_PLAN: LevelPlan<ScrapShoveState, ScrapShoveMove> = {
  gameId: 'scrap-shove',
  packs: [
    { id: 'junkyard', nameId: 'scrap-shove.pack-name.1' },
    { id: 'factory-floor', nameId: 'scrap-shove.pack-name.2' },
    { id: 'robot-city', nameId: 'scrap-shove.pack-name.3' },
  ],
  levelsPerPack: LEVELS_PER_PACK,
  difficultyFor,
  create,
  solver: SCRAP_SHOVE_SOLVER,
  maxNodes: 60_000,
  maxTries: 50,
  rate: (candidate) => {
    if (candidate.par < minParFor(candidate.level)) return null;
    return randomWins(candidate.start) > RANDOM_WINS_ALLOWED
      ? null
      : { kind: 'par', par: candidate.par };
  },
};
