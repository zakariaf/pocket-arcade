// apps/flock-tilt/src/rules/flock-tilt-tuning.ts
// Every balance number of Flock Tilt, in one place. The rules import these and contain no other
// balance numbers. Change a knob only together with a sim run (npm run test:sim) and compare
// reports/sim/flock-tilt.json before and after; test/sims/flock-tilt/balance-bands.json says what
// "balanced" means. A change after the level packs exist regenerates them with a Gate-Change.
// Flock Tilt has no endless mode: difficulty 100 is simply the hardest row.
import { rowFor } from '@e07/game-kit/contract/difficulty.ts';

/** The knobs that change by difficulty row: one row per band of the level scale 0..99. */
export type DifficultyKnobs = {
  /** Sheep on the field at the start (more = harder: more to pen, and they block each other). */
  readonly sheep: number;
  /** Wolves on the field (more = harder: more places a sheep must never stop beside). */
  readonly wolves: number;
  /** Fewest rocks drawn (more rocks = more places to stop, so shorter slides). */
  readonly minRocks: number;
  /** Most rocks drawn. */
  readonly maxRocks: number;
  /** Fewest tilts a field of this row may need (higher = harder; the par band's floor). */
  readonly minPar: number;
  /** Most tilts a field of this row may need (the par band's ceiling; create searches this deep). */
  readonly maxPar: number;
};

/**
 * Level rows, easiest first; each clearly harder than the one before (the sim checks the curve).
 * Difficulty 0..99 picks a row with rowFor (four rows: 0-24, 25-49, 50-74, 75-99).
 */
const LEVEL_ROWS = [
  { sheep: 2, wolves: 1, minRocks: 6, maxRocks: 8, minPar: 3, maxPar: 4 },
  { sheep: 3, wolves: 1, minRocks: 6, maxRocks: 8, minPar: 4, maxPar: 5 },
  { sheep: 4, wolves: 1, minRocks: 5, maxRocks: 7, minPar: 5, maxPar: 6 },
  { sheep: 5, wolves: 2, minRocks: 5, maxRocks: 7, minPar: 6, maxPar: 8 },
] as const satisfies readonly DifficultyKnobs[];

export const TUNING = {
  /** Columns and rows of the field (spec 13: "one 7x7 field"). */
  side: 7,
  /** Tilts a run may make before it ends ("No tilts left"); undo gives tilts back. */
  tiltLimit: 40,
  /** Extra tilts the one continue gives (spec 8.10). */
  continueTilts: 10,
  /** Points per sheep in the pen (the top bar's score and part of the win score). */
  pointsPerSheep: 100,
  /** Points per tilt left of the budget when the field is cleared. */
  pointsPerSpareTilt: 10,
  /** Fields create draws from one seed before it uses the prepared fallback field. */
  drawAttempts: 2000,
  /** Search nodes create may spend proving one drawn field. */
  searchNodes: 20_000,
  /** Per-difficulty knobs (the table above). */
  levelRows: LEVEL_ROWS,
} as const;

/** The knobs of a difficulty (0..100, clamped): the level row rowFor picks. */
export function knobsFor(difficulty: number): DifficultyKnobs {
  const row = rowFor(difficulty, TUNING.levelRows.length);
  // A reduce over the non-empty table: no unreachable `?? table[0]` branch for the coverage gate.
  const rows: readonly DifficultyKnobs[] = TUNING.levelRows;
  return rows.reduce((picked, knobs, index) => (index === row ? knobs : picked));
}
