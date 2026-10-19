// apps/stepstone/src/rules/stepstone-tuning.ts
// Every balance number of Stepstone, in one place. The rules import these and contain no other
// balance numbers. Change a knob only together with a sim run (npm run test:sim) and compare
// reports/sim/stepstone.json before and after; test/sims/stepstone/balance-bands.json says what
// "balanced" means. A change after the level packs exist regenerates them with a Gate-Change.
// Stepstone has no endless mode, so 100 is simply the hardest pond.
import { rowFor } from '@e07/game-kit/contract/difficulty.ts';

import type { MoveKind } from './stepstone-types.ts';

/** The knobs that change by difficulty row: one row per band of the level scale 0..99. */
export type DifficultyKnobs = {
  /** Cells per side of the square pond (bigger = more stones to read and more routes). */
  readonly side: number;
  /** The hop kinds the stones carry (more kinds = more to read; the knight is the hardest). */
  readonly kinds: readonly MoveKind[];
  /** Hops on the route laid first, which proves the pond solvable (longer = longer par). */
  readonly routeHops: number;
  /** Stones laid beside the route where its hops reach (more = more side hops that may strand). */
  readonly decoys: number;
  /** The fewest hops a pond must need; a shorter pond is laid again (higher = no easy ponds). */
  readonly minPar: number;
};

/**
 * Level rows, easiest first; each clearly harder than the one before (the sim checks the curve).
 * Difficulty 0..99 picks a row with rowFor (four rows: 0-24, 25-49, 50-74, 75-99); the daily plays
 * 45, in the second row.
 */
const LEVEL_ROWS = [
  { side: 5, kinds: ['rook', 'king'], routeHops: 4, decoys: 4, minPar: 3 },
  { side: 5, kinds: ['rook', 'king', 'bishop'], routeHops: 5, decoys: 5, minPar: 4 },
  { side: 6, kinds: ['rook', 'king', 'bishop', 'knight'], routeHops: 6, decoys: 7, minPar: 5 },
  { side: 7, kinds: ['rook', 'king', 'bishop', 'knight'], routeHops: 7, decoys: 9, minPar: 6 },
] as const satisfies readonly DifficultyKnobs[];

export const TUNING = {
  /** Ponds laid per create() before the longest one so far is kept (more = fewer short ponds). */
  layAttempts: 64,
  /** Per-difficulty knobs (the table above). */
  levelRows: LEVEL_ROWS,
} as const;

/** The knobs of a difficulty (0..100, clamped): the level row rowFor picks. */
export function knobsFor(difficulty: number): DifficultyKnobs {
  const row = rowFor(difficulty, TUNING.levelRows.length);
  // A reduce over the non-empty table: no unreachable `?? table[0]` branch for the coverage gate.
  return TUNING.levelRows.reduce((picked, knobs, index) => (index === row ? knobs : picked));
}
