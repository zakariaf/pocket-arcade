// apps/tap-flip/src/rules/tap-flip-tuning.ts
// Every balance number of the game, in one place. The rules import these and contain no other
// balance numbers. Change a knob only together with a sim run (npm run test:sim) and compare
// reports/sim/tap-flip.json before and after; test/sims/tap-flip/balance-bands.json says what
// "balanced" means. A change after the level packs exist regenerates them with a Gate-Change.
// The template game (Tap Flip) has no endless mode. A game with one adds an endless row (goal 0:
// never won) and returns it first in knobsFor for isEndlessDifficulty(difficulty) (see the Line
// Siege example of the game-balance-and-bots skill).
import { clampDifficulty, rowFor } from '@e07/game-kit/contract/difficulty.ts';

/** The knobs that change by difficulty row: one row per band of the level scale 0..99. */
export type DifficultyKnobs = {
  /** Cells per side of the square board (bigger = harder: more cells to think about). */
  readonly side: number;
};

/**
 * Level rows, easiest first; each clearly harder than the one before (the sim checks the curve).
 * Difficulty 0..99 picks a row with rowFor (three rows: 0-33, 34-66, 67-99). Tap Flip's levels
 * stop at 60 and its daily plays 40, both in the 4x4 row. Columns as documented on DifficultyKnobs.
 */
const LEVEL_ROWS = [
  { side: 3 },
  { side: 4 },
  { side: 5 },
] as const satisfies readonly DifficultyKnobs[];

export const TUNING = {
  /** Scramble presses at difficulty 0; a level's par is at most its presses (more = harder). */
  minPresses: 2,
  /** One more scramble press every this many difficulty points (lower = a steeper climb). */
  difficultyPerPress: 10,
  /** Moves the player gets per scramble press (more = kinder). */
  movesPerPress: 3,
  /** Points per move left over when the board goes dark (the win's score). */
  pointsPerSpareMove: 10,
  /** Moves the one continue gives back (spec 8.10; more = kinder). */
  continueMoves: 3,
  /** Per-difficulty knobs (the table above). */
  levelRows: LEVEL_ROWS,
} as const;

/** The knobs of a difficulty (0..100, clamped): the level row rowFor picks. */
export function knobsFor(difficulty: number): DifficultyKnobs {
  const row = rowFor(difficulty, TUNING.levelRows.length);
  // A reduce over the non-empty table: no unreachable `?? table[0]` branch for the coverage gate.
  return TUNING.levelRows.reduce((picked, knobs, index) => (index === row ? knobs : picked));
}

/** Scramble presses for a difficulty: minPresses, then one more every difficultyPerPress points. */
export function pressesFor(difficulty: number): number {
  return TUNING.minPresses + Math.floor(clampDifficulty(difficulty) / TUNING.difficultyPerPress);
}
