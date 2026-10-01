// apps/line-siege/src/rules/opening.ts
// The opening is built so the first placement can already fire a beam and defeat a monster
// (the fun-within-seconds kill test): one column and one row are two cells short, the tray holds
// the two bars that finish them, and the lowest monster of that column's lane has no more health
// than one beam deals.
import { nextInt } from '@e07/game-kit/rng/sfc32.ts';

import { isColumnFull, isRowFull } from './board-lines.ts';
import { TUNING, knobsFor } from './line-siege-tuning.ts';

import type { Cell, Monster } from './line-siege-types.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

const SIZE = TUNING.boardSize;
const SCATTER_TRIES = 300;

type Draw = { readonly value: number; readonly rng: RngState };

/** The prepared column and row, and where their two-cell gaps start. */
export type Opening = {
  readonly col: number;
  readonly row: number;
  readonly gapRow: number;
  readonly gapCol: number;
};

function draw(rng: RngState, max: number): Draw {
  const next = nextInt(rng, max);
  return { value: next.value, rng: next.state };
}

function drawExcept(rng: RngState, max: number, excluded: readonly number[]): Draw {
  let next = draw(rng, max);
  while (excluded.includes(next.value)) next = draw(next.rng, max);
  return next;
}

export function drawOpening(rng: RngState): { readonly opening: Opening; readonly rng: RngState } {
  const col = draw(rng, SIZE);
  const row = draw(col.rng, SIZE);
  const gapRow = drawExcept(row.rng, SIZE - 1, [row.value, row.value - 1]);
  const gapCol = drawExcept(gapRow.rng, SIZE - 1, [col.value, col.value - 1]);
  const opening = { col: col.value, row: row.value, gapRow: gapRow.value, gapCol: gapCol.value };
  return { opening, rng: gapCol.rng };
}

export function openingCells(opening: Opening): Cell[] {
  return Array.from({ length: SIZE * SIZE }, (_, index): Cell => {
    const col = index % SIZE;
    const row = Math.floor(index / SIZE);
    const isInColumn = col === opening.col && row !== opening.gapRow && row !== opening.gapRow + 1;
    const isInRow = row === opening.row && col !== opening.gapCol && col !== opening.gapCol + 1;
    return isInColumn || isInRow ? 1 : 0;
  });
}

/** Adds loose blocks off the prepared lines, never completing a line. */
export function scatter(
  cells: readonly Cell[],
  opening: Opening,
  rng: RngState,
): { readonly cells: Cell[]; readonly rng: RngState } {
  const next = [...cells];
  let state = rng;
  let placed = 0;
  for (let tries = 0; tries < SCATTER_TRIES && placed < TUNING.openingBlocks; tries += 1) {
    const pick = draw(state, SIZE * SIZE);
    state = pick.rng;
    const col = pick.value % SIZE;
    const row = Math.floor(pick.value / SIZE);
    if (next[pick.value] === 1 || col === opening.col || row === opening.row) continue;
    next[pick.value] = 1;
    if (isRowFull(next, row) || isColumnFull(next, col)) next[pick.value] = 0;
    else placed += 1;
  }
  return { cells: next, rng: state };
}

/** The weak monster in the prepared lane, and two ordinary ones in two other lanes. */
export function openingMonsters(
  opening: Opening,
  difficulty: number,
  rng: RngState,
): { readonly monsters: Monster[]; readonly rng: RngState } {
  const knobs = knobsFor(difficulty);
  const weak = draw(rng, 3);
  const first: Monster = {
    id: 1,
    kind: 'normal',
    lane: opening.col,
    row: 1,
    hp: TUNING.beamDamage - weak.value,
  };
  const laneA = drawExcept(weak.rng, SIZE, [opening.col]);
  const laneB = drawExcept(laneA.rng, SIZE, [opening.col, laneA.value]);
  const hpA = draw(laneB.rng, knobs.hpMax - knobs.hpMin + 1);
  const hpB = draw(hpA.rng, knobs.hpMax - knobs.hpMin + 1);
  const monsters: Monster[] = [
    first,
    { id: 2, kind: 'normal', lane: laneA.value, row: 0, hp: knobs.hpMin + hpA.value },
    { id: 3, kind: 'normal', lane: laneB.value, row: 0, hp: knobs.hpMin + hpB.value },
  ];
  return { monsters, rng: hpB.rng };
}
