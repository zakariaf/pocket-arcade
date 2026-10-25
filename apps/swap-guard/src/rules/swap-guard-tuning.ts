// apps/swap-guard/src/rules/swap-guard-tuning.ts
// Every balance number of Swap Guard, in one place. The rules import these and contain no other
// balance numbers. Change a knob only together with a sim run (npm run test:sim) and compare
// reports/sim/swap-guard.json before and after; test/sims/swap-guard/balance-bands.json says what
// "balanced" means. A change after the level packs exist regenerates them with a Gate-Change.
// Swap Guard has no endless mode: 100 is simply the hardest value create must still accept.
import { rowFor } from '@e07/game-kit/contract/difficulty.ts';

import type { EnemyKind } from './swap-guard-types.ts';

/** The knobs that change by difficulty row: one row per band of the level scale 0..99. */
export type DifficultyKnobs = {
  /** Squares per side of the board (bigger = longer walks and more room to hide). */
  readonly size: number;
  /** Enemies on the board, the opening pair included (more = harder: more strikes to read). */
  readonly enemies: number;
  /** The enemy kinds the board draws from (brutes strike all around: harder). */
  readonly kinds: readonly EnemyKind[];
  /** The most swaps a start may need: create keeps only starts its planned line wins within it. */
  readonly maxSwaps: number;
  /**
   * Swaps a level gives beyond its planned line (fewer = harder): a start's budget is the planned
   * line's length plus these, at most maxSwaps.
   */
  readonly spareSwaps: number;
};

/**
 * Level rows, easiest first; each clearly harder than the one before (the sim checks the curve).
 * Difficulty 0..99 picks a row with rowFor (four rows: 0-24, 25-49, 50-74, 75-99); the daily plays
 * 45, the second row. Columns as documented on DifficultyKnobs.
 */
const LEVEL_ROWS = [
  { size: 5, enemies: 3, kinds: ['spear'], maxSwaps: 12, spareSwaps: 3 },
  { size: 5, enemies: 4, kinds: ['spear', 'archer'], maxSwaps: 12, spareSwaps: 1 },
  { size: 6, enemies: 5, kinds: ['spear', 'archer', 'brute'], maxSwaps: 15, spareSwaps: 0 },
  { size: 6, enemies: 6, kinds: ['spear', 'archer', 'brute'], maxSwaps: 18, spareSwaps: 0 },
] as const satisfies readonly DifficultyKnobs[];

export const TUNING = {
  /** Points per enemy knocked out. */
  pointsPerEnemy: 100,
  /** Extra points per enemy beyond the first in one volley (the double hit). */
  pointsPerExtraEnemy: 50,
  /** Points per swap left over when the last enemy goes down (the win's bonus). */
  pointsPerSpareSwap: 10,
  /** Per-difficulty knobs (the table above). */
  levelRows: LEVEL_ROWS,
} as const;

/** The knobs of a difficulty (0..100, clamped): the level row rowFor picks. */
export function knobsFor(difficulty: number): DifficultyKnobs {
  const row = rowFor(difficulty, TUNING.levelRows.length);
  // A reduce over the non-empty table: no unreachable `?? table[0]` branch for the coverage gate.
  return TUNING.levelRows.reduce((picked, knobs, index) => (index === row ? knobs : picked));
}

/** The points one volley earns for knocking out `count` enemies at once. */
export function volleyPoints(count: number): number {
  if (count === 0) return 0;
  return count * TUNING.pointsPerEnemy + (count - 1) * TUNING.pointsPerExtraEnemy;
}
