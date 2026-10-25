// apps/swap-guard/src/rules/strikes.ts
// The telegraph: the squares every enemy will strike after the next swap, read from where everyone
// stands now. One resolution order: the strikes are listed by enemy and land at once.
import { FACINGS, stepFrom } from './board-grid.ts';

import type { Enemy, Strike, SwapGuardState } from './swap-guard-types.ts';

type Board = Pick<SwapGuardState, 'size' | 'guard' | 'enemies'>;

/** The squares one enemy strikes, given the squares the pieces stand on. */
export function strikeOf(size: number, enemy: Enemy, occupied: ReadonlySet<number>): number[] {
  if (enemy.kind === 'brute') {
    return FACINGS.map((facing) => stepFrom(size, enemy.cell, facing)).filter(
      (cell): cell is number => cell !== null,
    );
  }
  const cells: number[] = [];
  let next = stepFrom(size, enemy.cell, enemy.facing);
  while (next !== null) {
    cells.push(next);
    // A spear reaches one square; an arrow flies on until it meets a piece.
    if (enemy.kind === 'spear' || occupied.has(next)) break;
    next = stepFrom(size, next, enemy.facing);
  }
  return cells;
}

/** Every enemy's strike, in enemy order: the board shows these, and the next volley lands on them. */
export function strikesOf(board: Board): Strike[] {
  const occupied = new Set([board.guard, ...board.enemies.map((enemy) => enemy.cell)]);
  return board.enemies.map((enemy) => ({
    enemyId: enemy.id,
    cells: strikeOf(board.size, enemy, occupied),
  }));
}

/** The squares any strike covers. */
export function struckSquares(strikes: readonly Strike[]): Set<number> {
  return new Set(strikes.flatMap((strike) => strike.cells));
}
