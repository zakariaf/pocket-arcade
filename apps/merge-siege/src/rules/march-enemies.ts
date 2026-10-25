// apps/merge-siege/src/rules/march-enemies.ts
// The enemies' march (spec 13: "numbered enemies march in"). Every enemy steps one row down, the
// lowest row first: into an empty cell; onto a tile, which smashes it when the tile's number is the
// same or bigger (the design fix: ties go to the tile; the tile holds) and is crushed otherwise
// (the enemy moves in); behind another enemy it waits. An enemy on the bottom row never moves.
import { CELL_COUNT, COLS, ROWS } from './board-cells.ts';
import { TUNING } from './merge-siege-tuning.ts';
import { beats } from './slide-tiles.ts';

import type { Cell, Loss, Piece, Smash, Step } from './merge-siege-types.ts';

export type MarchResult = {
  readonly cells: readonly Cell[];
  readonly steps: readonly Step[];
  readonly smashes: readonly Smash[];
  readonly losses: readonly Loss[];
  /** Points scored: smashPoints per number of an enemy a tile held off. */
  readonly points: number;
};

/** What one enemy's step does: it moves (crushing a tile, perhaps), is smashed, or waits. */
type Stride = {
  readonly cells: readonly Cell[];
  readonly step: Step | null;
  readonly smash: Smash | null;
  readonly loss: Loss | null;
};

/** One enemy at `from` steps one row down (pure). */
function strideOf(cells: readonly Cell[], enemy: Piece, from: number): Stride {
  const to = from + COLS;
  const below = cells[to] ?? null;
  const next = [...cells];
  if (below?.kind === 'enemy') return { cells, step: null, smash: null, loss: null };
  if (below !== null && beats(below.value, enemy.value)) {
    next[from] = null;
    return {
      cells: next,
      step: null,
      smash: { id: enemy.id, tileId: below.id, cell: to, value: enemy.value },
      loss: null,
    };
  }
  next[to] = enemy;
  next[from] = null;
  const loss =
    below === null ? null : { id: below.id, enemyId: enemy.id, cell: to, value: below.value };
  return { cells: next, step: { id: enemy.id, from, to }, smash: null, loss };
}

/** The cells an enemy can step from, the lowest row first, each row in reading order. */
const MARCH_ORDER: readonly number[] = Array.from({ length: CELL_COUNT - COLS }, (_, index) => {
  const row = ROWS - 2 - Math.floor(index / COLS);
  return row * COLS + (index % COLS);
});

/** Every enemy steps one row down, the lowest row first. Pure: the input is never changed. */
export function marchEnemies(input: readonly Cell[]): MarchResult {
  let cells = input;
  const strides: Stride[] = [];
  for (const from of MARCH_ORDER) {
    const enemy = cells[from] ?? null;
    if (enemy?.kind !== 'enemy') continue;
    const stride = strideOf(cells, enemy, from);
    cells = stride.cells;
    strides.push(stride);
  }
  const smashes = strides.flatMap((stride) => (stride.smash === null ? [] : [stride.smash]));
  return {
    cells,
    steps: strides.flatMap((stride) => (stride.step === null ? [] : [stride.step])),
    smashes,
    losses: strides.flatMap((stride) => (stride.loss === null ? [] : [stride.loss])),
    points: smashes.reduce((sum, smash) => sum + smash.value * TUNING.smashPoints, 0),
  };
}
