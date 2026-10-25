// apps/merge-siege/src/rules/merge-siege-evaluate.ts
// How good a Merge Siege position looks to a reasonable player. Lives in rules/ because both the
// bots (testing/) and the level witness (levels/) play with it, and levels may import only rules.
// The search bots add the outcome themselves (a win above everything, a loss below).
import { COLS, ROWS } from './board-cells.ts';

import type { Cell, MergeSiegeState } from './merge-siege-types.ts';

/** Points count most: smashed enemies and merges are what the score is made of. */
const SCORE_WEIGHT = 3;
/** An enemy costs its number times the square of its row (one row from the bottom costs most). */
const DANGER_WEIGHT = 2;
/** An enemy with a tile below it that beats it is half beaten: that column holds. */
const GUARD_WEIGHT = 10;
/** Room to slide and merge. */
const FREE_WEIGHT = 4;
/** One big tile ploughs through a column: the biggest tile counts again. */
const BIG_TILE_WEIGHT = 2;

/** The first piece below a cell in its column, or null. */
function pieceBelow(cells: readonly Cell[], col: number, row: number): Cell {
  for (let below = row + 1; below < ROWS; below += 1) {
    const cell = cells[below * COLS + col] ?? null;
    if (cell !== null) return cell;
  }
  return null;
}

/** What one enemy costs: its danger, less a guard bonus when a tile below it beats it. */
function enemyCost(cells: readonly Cell[], index: number, value: number): number {
  const row = Math.floor(index / COLS);
  const below = pieceBelow(cells, index % COLS, row);
  const isGuarded = below?.kind === 'tile' && below.value >= value;
  return (row + 1) * (row + 1) * value * DANGER_WEIGHT - (isGuarded ? GUARD_WEIGHT * value : 0);
}

/** How good a position looks to the bots (higher is better). */
export function evaluateMergeSiege(state: MergeSiegeState): number {
  let value = state.score * SCORE_WEIGHT;
  let biggest = 0;
  state.cells.forEach((cell, index) => {
    if (cell === null) value += FREE_WEIGHT;
    else if (cell.kind === 'enemy') value -= enemyCost(state.cells, index, cell.value);
    else {
      value += cell.value;
      biggest = Math.max(biggest, cell.value);
    }
  });
  return value + biggest * BIG_TILE_WEIGHT;
}
