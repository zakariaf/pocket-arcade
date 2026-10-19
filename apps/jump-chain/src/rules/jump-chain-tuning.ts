// apps/jump-chain/src/rules/jump-chain-tuning.ts
// Every balance number of Jump Chain, in one place. The rules import these and contain no other
// balance numbers. Every number is a default until the owner's play-test. Change a knob only
// together with a sim run (npm run test:sim) and compare reports/sim/jump-chain.json before and
// after; test/sims/jump-chain/balance-bands.json says what "balanced" means. A change after the
// level packs exist regenerates them (generate-levels.ts) with a Gate-Change: trailer.
import { isEndlessDifficulty, rowFor } from '@e07/game-kit/contract/difficulty.ts';

/** The knobs that change with difficulty: one level row per band of 0..99, plus the endless row. */
export type DifficultyKnobs = {
  /** Ranks in the level, two rows apart (more = harder); 0 = endless: new ranks keep coming, never won. */
  readonly ranks: number;
  /** Chance in percent that each square of a rank holds an enemy (higher = more enemies to capture: harder). */
  readonly fill: number;
  /** The ranks advance one row after every Nth move (lower = faster: harder). */
  readonly marchEvery: number;
  /** The odd row the front rank starts on (higher = closer to your side: harder). */
  readonly frontRow: number;
};

/**
 * Level rows, easiest first; each row clearly harder than the one before (the sim checks the
 * curve). Difficulty 0..99 picks a row with rowFor (four rows: 0-24, 25-49, 50-74, 75-99), so the
 * daily's 45 plays the second row. Columns as documented on DifficultyKnobs.
 */
const LEVEL_ROWS = [
  { ranks: 3, fill: 85, marchEvery: 6, frontRow: 5 },
  { ranks: 4, fill: 80, marchEvery: 4, frontRow: 5 },
  { ranks: 5, fill: 75, marchEvery: 4, frontRow: 5 },
  { ranks: 6, fill: 70, marchEvery: 3, frontRow: 5 },
] as const satisfies readonly DifficultyKnobs[];

/** The endless run (difficulty 100, ENDLESS_DIFFICULTY): one rank always waits above the board. */
const ENDLESS_ROW = {
  /** 0: the endless run is never won, only survived. */
  ranks: 0,
  /** Each square of a new rank holds an enemy at this chance in percent (higher = harder). */
  fill: 70,
  /** The ranks advance after every Nth move (lower = harder). */
  marchEvery: 3,
  /** The odd row the front rank starts on; ranks are made up to the first row above the board. */
  frontRow: 5,
} as const satisfies DifficultyKnobs;

export const TUNING = {
  /** Board columns (7: symmetric, about 53 pt cells on a phone). */
  cols: 7,
  /** Board rows; the last one is your side (an enemy reaching it overruns you). */
  rows: 10,
  /** Where your piece starts: the middle column, two rows below the front rank of row 5. */
  pieceStart: { col: 3, row: 7 },
  /** Rows between two ranks: the dark squares of every other row. */
  rankGap: 2,
  /** Rows an enemy moves when the ranks advance (straight down, so it stays on a dark square). */
  marchRows: 2,
  /** Points of the n-th jump of a chain: n x jumpPoints (a 1-chain 10, a 2-chain 30, a 3-chain 60). */
  jumpPoints: 10,
  /** Points for capturing the last enemy of a rank. */
  rankPoints: 50,
  /** Rows the one continue moves every enemy back up (spec 8.10: one rank row; more = kinder). */
  continueRows: 2,
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

/** Points of a chain of n jumps: jumpPoints x (1 + 2 + ... + n). */
export function chainPoints(jumps: number): number {
  return (TUNING.jumpPoints * jumps * (jumps + 1)) / 2;
}
