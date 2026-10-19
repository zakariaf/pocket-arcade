// apps/scrap-shove/src/rules/scrap-shove-tuning.ts
// Every balance number of Scrap Shove, in one place. The rules import these and contain no other
// balance numbers. Every number is a default until the owner's play-test. Change a knob only
// together with a sim run (npm run test:sim) and compare reports/sim/scrap-shove.json before and
// after; test/sims/scrap-shove/balance-bands.json says what "balanced" means. A change after the
// level packs exist regenerates them (generate-levels.ts) with a Gate-Change: trailer.
// Scrap Shove has no endless mode: 100 is simply the hardest row.
import { rowFor } from '@e07/game-kit/contract/difficulty.ts';

/** The knobs that change with difficulty: one row per band of the level scale 0..99. */
export type DifficultyKnobs = {
  /** Normal robots, the opening crash pair included (more = harder, but also more crashes). */
  readonly normal: number;
  /** Fast robots, two steps a turn (more = harder: less time to line up a shove). */
  readonly fast: number;
  /** Heavy robots, scrapped only by a shoved heap (more = harder: each needs a crush). */
  readonly heavy: number;
  /** Scrap heaps on the floor at the start, one in each heavy robot's lane first (more = easier). */
  readonly heaps: number;
};

/**
 * Level rows, easiest first; each harder than the one before (the sim checks the curve).
 * Difficulty 0..99 picks a row with rowFor (four rows: 0-24, 25-49, 50-74, 75-99); the daily plays
 * 45, in the second row. Columns as documented on DifficultyKnobs.
 */
const LEVEL_ROWS = [
  { normal: 4, fast: 0, heavy: 1, heaps: 3 },
  { normal: 5, fast: 1, heavy: 1, heaps: 3 },
  { normal: 6, fast: 1, heavy: 2, heaps: 4 },
  { normal: 7, fast: 2, heavy: 3, heaps: 4 },
] as const satisfies readonly DifficultyKnobs[];

export const TUNING = {
  /** Squares per side of the one floor (spec 13: one grid size; 8 keeps squares at 44 pt+). */
  side: 8,
  /** No robot starts closer than this (Chebyshev squares): floor 1 never corners the player. */
  robotStartDistance: 3,
  /** Fast robots start at least this far: they close two squares a turn. */
  fastStartDistance: 4,
  /** The opening crash pair starts at most this far away, so the first crash comes on move 1. */
  crashPairMaxDistance: 4,
  /** A heap placed ahead of a normal robot lies this many of its steps ahead of it. */
  heapLeadSteps: 2,
  /** Random heaps start at least this far from the player. */
  heapStartDistance: 2,
  /** Points per robot scrapped (the score in the top bar). */
  pointsPerRobot: 10,
  /** Per-difficulty knobs (the table above). */
  levelRows: LEVEL_ROWS,
} as const;

/** The knobs of a difficulty (0..100, clamped): the level row rowFor picks. */
export function knobsFor(difficulty: number): DifficultyKnobs {
  const row = rowFor(difficulty, TUNING.levelRows.length);
  // A reduce over the non-empty table: no unreachable `?? table[0]` branch for the coverage gate.
  return TUNING.levelRows.reduce((picked, knobs, index) => (index === row ? knobs : picked));
}
