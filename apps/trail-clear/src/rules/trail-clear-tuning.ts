// apps/trail-clear/src/rules/trail-clear-tuning.ts
// Every balance number of Trail Clear, in one place. The rules import these and contain no other
// balance numbers. Every number is a default until the owner's play-test. Change a knob only
// together with a sim run (npm run test:sim) and compare reports/sim/trail-clear.json before and
// after; test/sims/trail-clear/balance-bands.json says what "balanced" means. A change after the
// level packs exist regenerates them (generate-levels.ts) with a Gate-Change: trailer.
import { isEndlessDifficulty, rowFor } from '@e07/game-kit/contract/difficulty.ts';

import type { TileKind } from './trail-clear-types.ts';

/** How often each kind is dealt (out of the row's sum); a kind with weight 0 is never dealt. */
export type TileWeights = Readonly<Record<TileKind, number>>;

/** The knobs that change with difficulty: one level row per band of 0..99, plus the endless row. */
export type DifficultyKnobs = {
  /** Tiles in the level's bag; placing the last one wins (0 = endless: the bag never empties). */
  readonly bag: number;
  /** Chance in percent that the next tile is one that closes a loop somewhere (higher = kinder). */
  readonly helpfulShare: number;
  /** Which kinds are dealt (more bends, forks and two-terrain tiles = harder). */
  readonly weights: TileWeights;
};

/** Ends, straights and bends of both terrains, and the ford: no tile without grass. */
const GENTLE: TileWeights = {
  'road-end': 5,
  'road-straight': 2,
  'road-bend': 3,
  'river-end': 5,
  'river-straight': 2,
  'river-bend': 3,
  ford: 3,
  bridge: 0,
  'twin-bend': 0,
  'road-fork': 0,
};
/** Fewer end pieces; the bridge appears (it only fits the inner cells). */
const BRIDGES: TileWeights = { ...GENTLE, 'road-end': 4, 'river-end': 4, bridge: 1 };
/** An even mix with every two-terrain tile. */
const MIXED: TileWeights = {
  'road-end': 3,
  'road-straight': 3,
  'road-bend': 3,
  'river-end': 3,
  'river-straight': 3,
  'river-bend': 3,
  ford: 2,
  bridge: 1,
  'twin-bend': 1,
  'road-fork': 0,
};
/** More bends, two-terrain tiles and the road fork: longer loops, fuller boards. */
const KNOTTY: TileWeights = {
  ...MIXED,
  'road-bend': 4,
  'river-bend': 4,
  bridge: 2,
  'road-fork': 1,
};

/**
 * Level rows, easiest first; each row clearly harder than the one before (the sim checks the
 * curve). Difficulty 0..99 picks a row with rowFor (four rows: 0-24, 25-49, 50-74, 75-99), so the
 * daily's 45 plays the second row. Columns as documented on DifficultyKnobs.
 */
const LEVEL_ROWS = [
  { bag: 24, helpfulShare: 40, weights: GENTLE },
  { bag: 28, helpfulShare: 30, weights: BRIDGES },
  { bag: 32, helpfulShare: 25, weights: MIXED },
  { bag: 36, helpfulShare: 20, weights: KNOTTY },
] as const satisfies readonly DifficultyKnobs[];

/** The endless run (difficulty 100, ENDLESS_DIFFICULTY): the bag never empties. */
const ENDLESS_ROW = {
  /** 0: the endless run is never won, only survived. */
  bag: 0,
  /** As the third level row (higher = kinder). */
  helpfulShare: 25,
  weights: MIXED,
} as const satisfies DifficultyKnobs;

export const TUNING = {
  /** The board is boardSize x boardSize cells (spec 13: a 5 x 5 board). */
  boardSize: 5,
  /** A closed loop of n tiles scores tilePoints x n x n (a long loop is worth the fuller board). */
  tilePoints: 10,
  /** A placement that closes a road and a river at once scores both, times this (the twist). */
  doubleMultiplier: 2,
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

/** The points a closed loop of `size` tiles scores. */
export function loopPoints(size: number): number {
  return TUNING.tilePoints * size * size;
}
