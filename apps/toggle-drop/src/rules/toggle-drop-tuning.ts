// apps/toggle-drop/src/rules/toggle-drop-tuning.ts
// Every balance number of Toggle Drop, in one place. The rules import these and contain no other
// balance numbers. Change a knob only together with a sim run (npm run test:sim) and compare
// reports/sim/toggle-drop.json before and after; test/sims/toggle-drop/balance-bands.json says what
// "balanced" means. A change after the level packs exist regenerates them with a Gate-Change.
// Toggle Drop has no endless mode: 100 is simply the hardest board.
import { rowFor } from '@e07/game-kit/contract/difficulty.ts';

/** The knobs that change by difficulty row: one row per band of the level scale 0..99. */
export type DifficultyKnobs = {
  /** Drop columns (more = more choices each drop). */
  readonly cols: number;
  /** Peg rows the ball falls through (more = longer chains of switches). */
  readonly rows: number;
  /** Switches in each peg row (more = more of the board flips). */
  readonly switchesPerRow: number;
  /** Cups on the board (more = more to fill). */
  readonly cups: number;
  /**
   * Drops of the hidden winning line the board is built from: every board is solvable in this
   * many drops, and its cups need as many balls as land there (more = longer puzzles).
   */
  readonly witnessDrops: number;
  /** Balls given beyond the winning line (more = kinder). */
  readonly spareBalls: number;
};

/**
 * Level rows, easiest first; each clearly harder than the one before (the sim checks the curve).
 * Difficulty 0..99 picks a row with rowFor (four rows: 0-24, 25-49, 50-74, 75-99).
 */
const LEVEL_ROWS = [
  { cols: 5, rows: 3, switchesPerRow: 2, cups: 2, witnessDrops: 2, spareBalls: 4 },
  { cols: 5, rows: 4, switchesPerRow: 2, cups: 3, witnessDrops: 4, spareBalls: 3 },
  { cols: 6, rows: 4, switchesPerRow: 3, cups: 3, witnessDrops: 5, spareBalls: 3 },
  { cols: 7, rows: 5, switchesPerRow: 3, cups: 3, witnessDrops: 6, spareBalls: 3 },
] as const satisfies readonly DifficultyKnobs[];

export const TUNING = {
  /** Layouts create() may draw before it keeps the last one (each draw is seeded). */
  layoutAttempts: 200,
  /** Per-difficulty knobs (the table above). */
  levelRows: LEVEL_ROWS,
} as const;

/** The knobs of a difficulty (0..100, clamped): the level row rowFor picks. */
export function knobsFor(difficulty: number): DifficultyKnobs {
  const row = rowFor(difficulty, TUNING.levelRows.length);
  // A reduce over the non-empty table: no unreachable `?? table[0]` branch for the coverage gate.
  return TUNING.levelRows.reduce((picked, knobs, index) => (index === row ? knobs : picked));
}
