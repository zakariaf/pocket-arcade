// apps/snare-snake/src/rules/snare-snake-tuning.ts
// Every balance number of Snare Snake, in one place. The rules import these and contain no other
// balance numbers. Every number is a default until the owner's play-test. Change a knob only
// together with a sim run (npm run test:sim) and compare reports/sim/snare-snake.json before and
// after; test/sims/snare-snake/balance-bands.json says what "balanced" means. A change after the
// level packs exist regenerates them (generate-levels.ts) with a Gate-Change: trailer.
// Snare Snake has no endless mode (Levels + Daily), so 100 is simply the hardest row.
import { rowFor } from '@e07/game-kit/contract/difficulty.ts';

/** The knobs that change by difficulty row: one row per band of the level scale 0..99. */
export type DifficultyKnobs = {
  /** Board columns (more = more room for the critters to roam: harder). */
  readonly cols: number;
  /** Board rows (more = more room for the critters to roam: harder). */
  readonly rows: number;
  /** Critters of the level, all on the board from the start (more = harder). */
  readonly critters: number;
  /** Critters that start in the nest the snake is coiled around (more = an easier start). */
  readonly nestCritters: number;
  /** Moves the level gives (more = kinder). */
  readonly maxMoves: number;
  /** The critters hop on every Nth move (higher = calmer). */
  readonly hopEvery: number;
  /** The snake grows one segment every Nth move (lower = kinder: more length for loops). */
  readonly growEvery: number;
};

/**
 * Level rows, easiest first; each clearly harder than the one before (the sim checks the curve).
 * Difficulty 0..99 picks a row with rowFor (four rows: 0-24, 25-49, 50-74, 75-99), so the daily's
 * 45 plays the second row. Columns as documented on DifficultyKnobs.
 */
const LEVEL_ROWS = [
  { cols: 7, rows: 8, critters: 4, nestCritters: 2, maxMoves: 30, hopEvery: 2, growEvery: 3 },
  { cols: 7, rows: 9, critters: 5, nestCritters: 1, maxMoves: 30, hopEvery: 2, growEvery: 3 },
  { cols: 8, rows: 9, critters: 6, nestCritters: 1, maxMoves: 32, hopEvery: 1, growEvery: 3 },
  { cols: 8, rows: 10, critters: 7, nestCritters: 1, maxMoves: 34, hopEvery: 1, growEvery: 4 },
] as const satisfies readonly DifficultyKnobs[];

export const TUNING = {
  /** Segments of the snake at the start (the design fix: the toy's 5 could not make a ring). */
  startLength: 10,
  /** Ring cells left open in front of the head: the first loop is nestGap + 1 moves away. */
  nestGap: 2,
  /** Segments the snake grows for every critter caught (more = kinder). */
  growPerCritter: 2,
  /** A loop catching n critters scores catchPoints x n x n (bigger loops pay more). */
  catchPoints: 10,
  /** Points per move left when the last critter is caught (the win's bonus). */
  pointsPerSpareMove: 5,
  /** Moves the one continue gives back (spec 8.10; more = kinder). */
  continueMoves: 3,
  /** Seeded layouts create tries before giving up (each try draws a new nest, coil and critters). */
  layoutAttempts: 64,
  /** Seeded cells tried per roaming critter in one layout (a crowded board needs more). */
  critterAttempts: 100,
  /** Per-difficulty knobs (the table above). */
  levelRows: LEVEL_ROWS,
} as const;

/** The knobs of a difficulty (0..100, clamped): the level row rowFor picks. */
export function knobsFor(difficulty: number): DifficultyKnobs {
  const row = rowFor(difficulty, TUNING.levelRows.length);
  // A reduce over the non-empty table: no unreachable `?? table[0]` branch for the coverage gate.
  return TUNING.levelRows.reduce((picked, knobs, index) => (index === row ? knobs : picked));
}
