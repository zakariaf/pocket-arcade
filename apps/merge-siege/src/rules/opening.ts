// apps/merge-siege/src/rules/opening.ts
// The prepared opening (design notes, the design fix item 4; game-balance-and-bots' kill test):
// two weak enemies (2s) stand in rows 1 and 2 of two columns, a 2 of the player's waits at the
// bottom of each of those columns, and a 4 sits in a third column. So the first swipe up smashes
// both enemies at once: the first payoff and the twist in move 1.
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { nextInt } from '@e07/game-kit/rng/sfc32.ts';

import { CELL_COUNT, COLS, ROWS, cellAt } from './board-cells.ts';

import type { Cell } from './merge-siege-types.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

/** The prepared columns: the first enemy's, the second enemy's, and the spare 4's. */
export type Opening = { readonly first: number; readonly second: number; readonly spare: number };

type ColumnDraw = { readonly col: number; readonly rng: RngState };

/** A column outside `taken`, drawn among the columns left over (one draw, no retry loop). */
function drawColumn(rng: RngState, taken: readonly number[]): ColumnDraw {
  const left = Array.from({ length: COLS }, (_, col) => col).filter((col) => !taken.includes(col));
  const draw = nextInt(rng, left.length);
  return { col: pickAt(left, draw.value), rng: draw.state };
}

/** The three opening columns, drawn from the seeded stream. */
export function drawOpening(rng: RngState): { readonly opening: Opening; readonly rng: RngState } {
  const first = drawColumn(rng, []);
  const second = drawColumn(first.rng, [first.col]);
  const spare = drawColumn(second.rng, [first.col, second.col]);
  return { opening: { first: first.col, second: second.col, spare: spare.col }, rng: spare.rng };
}

/** The opening board with its piece ids 1..5; both enemies count as entered. */
export function openingCells(opening: Opening): {
  readonly cells: Cell[];
  readonly enemies: number;
  readonly nextId: number;
} {
  const cells: Cell[] = Array.from({ length: CELL_COUNT }, (): Cell => null);
  cells[cellAt(opening.first, 1)] = { id: 1, kind: 'enemy', value: 2 };
  cells[cellAt(opening.second, 2)] = { id: 2, kind: 'enemy', value: 2 };
  cells[cellAt(opening.first, ROWS - 2)] = { id: 3, kind: 'tile', value: 2 };
  cells[cellAt(opening.second, ROWS - 1)] = { id: 4, kind: 'tile', value: 2 };
  cells[cellAt(opening.spare, ROWS - 1)] = { id: 5, kind: 'tile', value: 4 };
  return { cells, enemies: 2, nextId: 6 };
}
