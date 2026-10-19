// apps/merge-siege/src/rules/merge-siege-tuning.ts
// Every balance number of Merge Siege, in one place. The rules import these and contain no other
// balance numbers. Every number is a default until the owner's play-test. Change a knob only
// together with a sim run (npm run test:sim) and compare reports/sim/merge-siege.json before and
// after; test/sims/merge-siege/balance-bands.json says what "balanced" means. A change after the
// level packs exist regenerates them (generate-levels.ts) with a Gate-Change: trailer.
import { isEndlessDifficulty, rowFor } from '@e07/game-kit/contract/difficulty.ts';

/** The numbers an entering enemy can carry, smallest first (enemyWeights follows this order). */
export const ENEMY_VALUES = [2, 4, 8, 16, 32] as const;

/** Weights of ENEMY_VALUES out of their sum; a number with weight 0 never enters. */
export type EnemyWeights = readonly [number, number, number, number, number];

/** The knobs that change with difficulty: one level row per band of 0..99, plus the endless row. */
export type DifficultyKnobs = {
  /** Enemies in the level's wave, the two opening enemies included (0 = endless, never won). */
  readonly goal: number;
  /** The enemies step one row down every Nth swipe (higher = calmer). */
  readonly marchEvery: number;
  /** The next enemy enters every Nth swipe while the wave lasts (higher = fewer at once). */
  readonly spawnEvery: number;
  /** How often each enemy number enters (more weight on big numbers = harder). */
  readonly enemyWeights: EnemyWeights;
};

/**
 * Level rows, easiest first; each row clearly harder than the one before (the sim checks the
 * curve). Difficulty 0..99 picks a row with rowFor (four rows: 0-24, 25-49, 50-74, 75-99), so the
 * daily's 45 plays the second row. Columns as documented on DifficultyKnobs.
 */
const LEVEL_ROWS = [
  { goal: 8, marchEvery: 2, spawnEvery: 1, enemyWeights: [2, 2, 1, 0, 0] },
  { goal: 14, marchEvery: 2, spawnEvery: 1, enemyWeights: [2, 3, 2, 0, 0] },
  { goal: 16, marchEvery: 2, spawnEvery: 1, enemyWeights: [1, 2, 3, 0, 0] },
  { goal: 18, marchEvery: 2, spawnEvery: 1, enemyWeights: [1, 2, 2, 1, 0] },
] as const satisfies readonly DifficultyKnobs[];

/** The endless run (difficulty 100, ENDLESS_DIFFICULTY): the wave never ends and numbers grow. */
const ENDLESS_ROW = {
  /** 0: the endless run is never won, only survived. */
  goal: 0,
  /** The enemies step every Nth swipe (as the level rows; higher = calmer). */
  marchEvery: 2,
  /** A new enemy every Nth swipe, for ever (higher = calmer). */
  spawnEvery: 1,
  /** The starting mix before the numbers step up (endlessStepEvery). */
  enemyWeights: [2, 2, 1, 0, 0],
} as const satisfies DifficultyKnobs;

export const TUNING = {
  /** Board columns (the toy's 5). */
  cols: 5,
  /** Board rows (the toy's 6); an enemy reaching the last row has overrun the board. */
  rows: 6,
  /** New tiles appear in the bottom spawnRows rows (the player's side). */
  spawnRows: 2,
  /** A new tile appears only while the board has at least this many empty cells (no jam). */
  minFreeCells: 2,
  /** One new tile in fourIn is a 4, the others are 2s (2048's mix). */
  fourIn: 10,
  /** Points per number of a smashed enemy (an 8 scores 80). */
  smashPoints: 10,
  /** Rows the one continue pushes every enemy back (spec 8.10: "pushed back one row"). */
  continuePushBack: 1,
  /** Endless: every Nth swipe the entering enemies' numbers step up one size (lower = harder). */
  endlessStepEvery: 20,
  /** Endless: the numbers step up at most this many times (the biggest enemy is then a 1024). */
  endlessMaxSteps: 5,
  /** Per-difficulty knobs (the tables above). */
  levelRows: LEVEL_ROWS,
  endlessRow: ENDLESS_ROW,
} as const;

/** The knobs of a difficulty 0..100: the endless row at 100, else the level row rowFor picks. */
export function knobsFor(difficulty: number): DifficultyKnobs {
  if (isEndlessDifficulty(difficulty)) return TUNING.endlessRow;
  const row = rowFor(difficulty, TUNING.levelRows.length);
  // A reduce over the non-empty table: no unreachable `?? table[0]` branch for the coverage gate.
  return TUNING.levelRows.reduce((picked, knobs, index) => (index === row ? knobs : picked));
}
