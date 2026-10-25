// apps/merge-siege/src/rules/next-enemy.ts
// The enemy waves come from the seed (spec 8.1, 8.3): the next enemy's column and number are drawn
// from the RNG the state carries, weighted by the difficulty row; in the endless run the numbers
// step up one size every endlessStepEvery swipes.
import { isEndlessDifficulty } from '@e07/game-kit/contract/difficulty.ts';
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { nextInt } from '@e07/game-kit/rng/sfc32.ts';

import { COLS } from './board-cells.ts';
import { ENEMY_VALUES, TUNING, knobsFor } from './merge-siege-tuning.ts';

import type { NextEnemy } from './merge-siege-types.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

/** What a draw needs: the stream, the run's difficulty and the swipes made so far. */
export type NextEnemyDraw = {
  readonly rng: RngState;
  readonly difficulty: number;
  readonly swipes: number;
};

/** How many sizes the endless run has stepped up after this many swipes (0 in a level). */
export function endlessSizeSteps(difficulty: number, swipes: number): number {
  if (!isEndlessDifficulty(difficulty)) return 0;
  return Math.min(Math.floor(swipes / TUNING.endlessStepEvery), TUNING.endlessMaxSteps);
}

/** The index of ENEMY_VALUES a draw from 0..sum(weights)-1 lands on (the first band past it). */
function weightedIndex(weights: readonly number[], draw: number): number {
  let upTo = 0;
  const bandEnds = weights.map((weight) => {
    upTo += weight;
    return upTo;
  });
  return bandEnds.findIndex((end) => draw < end);
}

/** The next enemy (its column and number) and the stream after the draws. */
export function drawNextEnemy(draw: NextEnemyDraw): {
  readonly next: NextEnemy;
  readonly rng: RngState;
} {
  const { enemyWeights } = knobsFor(draw.difficulty);
  const col = nextInt(draw.rng, COLS);
  const total = enemyWeights.reduce((sum, weight) => sum + weight, 0);
  const size = nextInt(col.state, total);
  let value: number = pickAt(ENEMY_VALUES, weightedIndex(enemyWeights, size.value));
  for (let step = 0; step < endlessSizeSteps(draw.difficulty, draw.swipes); step += 1) value *= 2;
  return { next: { col: col.value, value }, rng: size.state };
}
