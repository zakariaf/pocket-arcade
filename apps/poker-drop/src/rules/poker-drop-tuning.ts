// apps/poker-drop/src/rules/poker-drop-tuning.ts
// Every balance number of Poker Drop, in one place. The rules import these and contain no other
// balance numbers. Every number is a default until the owner's play-test. Change a knob only
// together with a sim run (npm run test:sim) and compare reports/sim/poker-drop.json before and
// after; test/sims/poker-drop/balance-bands.json says what "balanced" means. A change after the
// level packs exist regenerates them (generate-levels.ts) with a Gate-Change: trailer.
import { isEndlessDifficulty, rowFor } from '@e07/game-kit/contract/difficulty.ts';

/** The knobs that change with difficulty: one level row per band of 0..99, plus the endless row. */
export type DifficultyKnobs = {
  /** Hands the level asks for; reaching them wins it (0 = endless, never won). */
  readonly goal: number;
  /** Lowest rank in the deck, 2..14 (higher = a shorter deck with more pairs and straights = easier). */
  readonly minRank: number;
  /** Bottom rows dealt into the four columns beside the empty gap column (more = a fuller well). */
  readonly openingRows: number;
  /** Of those rows, how many (from the bottom) are dealt as two pair (more = an earlier payoff). */
  readonly preparedRows: number;
  /** A new row of cards rises from the bottom after every Nth drop (lower = harder). */
  readonly riseEvery: number;
};

/**
 * Level rows, easiest first; each row clearly harder than the one before (the sim checks the
 * curve). Difficulty 0..99 picks a row with rowFor (four rows: 0-24, 25-49, 50-74, 75-99), so
 * the daily's 45 plays the second row. Columns as documented on DifficultyKnobs.
 */
const LEVEL_ROWS = [
  { goal: 6, minRank: 9, openingRows: 2, preparedRows: 2, riseEvery: 8 },
  { goal: 8, minRank: 7, openingRows: 2, preparedRows: 1, riseEvery: 7 },
  { goal: 8, minRank: 5, openingRows: 2, preparedRows: 1, riseEvery: 6 },
  { goal: 8, minRank: 2, openingRows: 2, preparedRows: 1, riseEvery: 5 },
] as const satisfies readonly DifficultyKnobs[];

/** The endless run (difficulty 100, ENDLESS_DIFFICULTY): the full deck, rising ever faster. */
const ENDLESS_ROW = {
  /** 0: the endless run is never won, only survived. */
  goal: 0,
  /** The full 52-card deck (as the hardest level row). */
  minRank: 2,
  /** Two dealt rows beside the gap. */
  openingRows: 2,
  /** No prepared two pair: the run earns every hand. */
  preparedRows: 0,
  /** The first rises come every 10th drop; endlessRampEvery makes them faster. */
  riseEvery: 10,
} as const satisfies DifficultyKnobs;

export const TUNING = {
  /** The well is wellCols columns wide (spec 13: a 5-column well). */
  wellCols: 5,
  /** ... and wellRows rows tall (more = more room before the well is full). */
  wellRows: 6,
  /** Cards in a line: every hand is five cards (a full row, five of a column, a long diagonal). */
  lineLength: 5,
  /** Points per hand kind, before the cascade step multiplies them (step 2 counts double). */
  handPoints: {
    /** Two pair, the weakest hand that bursts (more = a higher score for the commonest hand). */
    'two-pair': 20,
    /** Three of a kind. */
    'three-of-a-kind': 30,
    /** Five ranks in a run (the ace high or low). */
    straight: 40,
    /** Five cards of one suit. */
    flush: 50,
    /** Three of a kind and a pair. */
    'full-house': 70,
    /** Four (or five) of one rank. */
    'four-of-a-kind': 100,
    /** A straight in one suit, the best hand. */
    'straight-flush': 150,
  },
  /** Endless: every endlessRampEvery drops the rows rise one drop sooner (lower = harder). */
  endlessRampEvery: 40,
  /** Endless: the rows never rise more often than every endlessRiseMin-th drop. */
  endlessRiseMin: 3,
  /** Falling speed gained per tick, in cells per tick per tick (higher = faster drops). */
  gravity: 0.005,
  /** Ticks a burst takes before the cards above start to fall (120 ticks = 1 s). */
  burstTicks: 36,
  /** Ticks the well takes to rise one row. */
  riseTicks: 24,
  /** Hard cap of one move's simulation (20 s): a cascade always ends. */
  maxTicks: 2400,
  /** Rows of the well the one continue empties, from the top (spec 8.10; more = kinder). */
  continueRows: 1,
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

/**
 * Drops between two rises after `drops` drops: the row's riseEvery, and in the endless run one
 * fewer every endlessRampEvery drops, never below endlessRiseMin.
 */
export function riseIntervalFor(difficulty: number, drops: number): number {
  const knobs = knobsFor(difficulty);
  if (!isEndlessDifficulty(difficulty)) return knobs.riseEvery;
  const ramp = Math.floor(drops / TUNING.endlessRampEvery);
  return Math.max(knobs.riseEvery - ramp, TUNING.endlessRiseMin);
}
