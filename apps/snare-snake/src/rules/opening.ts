// apps/snare-snake/src/rules/opening.ts
// The opening of the design fix (design notes, "The design fix"): the snake starts coiled in a C
// around a nest of critters with TUNING.nestGap ring cells open in front of its head, so the first
// loop is nestGap + 1 moves away; the rest of the body trails away from the ring, and the other
// critters roam apart from the snake (never on a cell next to it). Every draw comes from the
// seeded RNG (spec 8.1: the same seed always makes the same level).
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';
import { nextInt, seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { neighboursOf, touchingCells } from './board-grid.ts';
import { TUNING } from './snare-snake-tuning.ts';

import type { Grid } from './board-grid.ts';
import type { DifficultyKnobs } from './snare-snake-tuning.ts';
import type { Critter } from './snare-snake-types.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

/** The nest: a box of cells (1 x 1, or 2 x 1 / 1 x 2 for two critters) the snake is coiled around. */
export type NestBox = {
  readonly col: number;
  readonly row: number;
  readonly width: number;
  readonly height: number;
};

export type Opening = {
  readonly snake: readonly number[];
  readonly critters: readonly Critter[];
  readonly rng: RngState;
};

/** A seeded draw of 0..n-1 that advances the stream it closes over. */
type Draw = (n: number) => number;

/** The board and the draws one layout uses. */
type Layout = { readonly grid: Grid; readonly draw: Draw };

/** The cells around the nest, clockwise from its top-start corner. */
export function ringAround(grid: Grid, nest: NestBox): number[] {
  const left = nest.col - 1;
  const right = nest.col + nest.width;
  const top = nest.row - 1;
  const bottom = nest.row + nest.height;
  const cells: number[] = [];
  for (let col = left; col <= right; col += 1) cells.push(top * grid.cols + col);
  for (let row = top + 1; row <= bottom; row += 1) cells.push(row * grid.cols + right);
  for (let col = right - 1; col >= left; col -= 1) cells.push(bottom * grid.cols + col);
  for (let row = bottom - 1; row > top; row -= 1) cells.push(row * grid.cols + left);
  return cells;
}

/** The nest's own cells, row by row. */
export function nestCells(grid: Grid, nest: NestBox): number[] {
  const cells: number[] = [];
  for (let row = nest.row; row < nest.row + nest.height; row += 1) {
    for (let col = nest.col; col < nest.col + nest.width; col += 1)
      cells.push(row * grid.cols + col);
  }
  return cells;
}

function drawNest({ grid, draw }: Layout, knobs: DifficultyKnobs): NestBox {
  const size = Math.max(knobs.nestCritters, 1);
  const isAcross = draw(2) === 0;
  const width = isAcross ? size : 1;
  const height = isAcross ? 1 : size;
  return {
    col: 1 + draw(grid.cols - width - 1),
    row: 1 + draw(grid.rows - height - 1),
    width,
    height,
  };
}

/** The tail beyond the ring: a seeded walk away from it; null when the walk runs into a corner. */
function trailTail(
  { grid, draw }: Layout,
  body: readonly number[],
  blocked: Set<number>,
): number[] | null {
  const tail: number[] = [];
  let end = pickAt(body, body.length - 1);
  while (body.length + tail.length < TUNING.startLength) {
    const options = neighboursOf(grid, end).filter((cell) => !blocked.has(cell));
    if (options.length === 0) return null;
    end = pickAt(options, draw(options.length));
    tail.push(end);
    blocked.add(end);
  }
  return tail;
}

/** The coiled snake around a drawn nest, or null when its tail found no room. */
function drawCoil(layout: Layout, knobs: DifficultyKnobs) {
  const { grid, draw } = layout;
  const nest = drawNest(layout, knobs);
  const ring = ringAround(grid, nest);
  const start = draw(ring.length);
  const isReversed = draw(2) === 1;
  const order = ring.map((_, index) =>
    pickAt(ring, (start + (isReversed ? ring.length - index : index)) % ring.length),
  );
  const body = order.slice(0, ring.length - TUNING.nestGap);
  const inner = nestCells(grid, nest);
  const tail = trailTail(layout, body, new Set([...ring, ...inner]));
  return tail === null ? null : { snake: [...body, ...tail], ring, inner };
}

/** The roaming critters on free cells away from the snake, or null when the board is too full. */
function placeRoamers(
  { grid, draw }: Layout,
  knobs: DifficultyKnobs,
  taken: Set<number>,
): Critter[] | null {
  const roamers: Critter[] = [];
  for (let id = knobs.nestCritters; id < knobs.critters; id += 1) {
    let cell: number | null = null;
    for (let tries = 0; tries < TUNING.critterAttempts && cell === null; tries += 1) {
      const candidate = draw(grid.cols * grid.rows);
      if (!taken.has(candidate)) cell = candidate;
    }
    if (cell === null) return null;
    roamers.push({ id, cell });
    taken.add(cell);
  }
  return roamers;
}

function drawLayout(layout: Layout, knobs: DifficultyKnobs): Omit<Opening, 'rng'> | null {
  const { grid } = layout;
  const coil = drawCoil(layout, knobs);
  if (coil === null) return null;
  const nested = coil.inner.slice(0, knobs.nestCritters).map((cell, id) => ({ id, cell }));
  const taken = new Set([
    ...coil.ring,
    ...coil.inner,
    ...coil.snake,
    ...touchingCells(grid, coil.snake),
  ]);
  const roamers = placeRoamers(layout, knobs, taken);
  return roamers === null ? null : { snake: coil.snake, critters: [...nested, ...roamers] };
}

/**
 * The seed of the last-resort opening: its first layout fits every difficulty row (a test checks
 * each row), so a seed whose layoutAttempts draws all fail (a daily's date seed included) still
 * makes a level, the same one on every phone.
 */
export const FALLBACK_SEED = 1;

/** The board and the knobs one opening is drawn for. */
type OpeningBoard = { readonly grid: Grid; readonly knobs: DifficultyKnobs };

/** Up to `attempts` layouts from the stream, each from fresh draws; null when none fits. */
function firstLayout(board: OpeningBoard, rng: RngState, attempts: number): Opening | null {
  let state = rng;
  const draw: Draw = (n) => {
    const next = nextInt(state, n);
    state = next.state;
    return next.value;
  };
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const layout = drawLayout({ grid: board.grid, draw }, board.knobs);
    if (layout !== null) return { ...layout, rng: state };
  }
  return null;
}

/**
 * The opening from the seeded stream with an explicit budget: up to `attempts` tries, then the
 * fallback seed's first layout. Throws only for a board no opening fits at all.
 */
export function drawOpeningWithin(board: OpeningBoard, rng: RngState, attempts: number): Opening {
  const opening =
    firstLayout(board, rng, attempts) ?? firstLayout(board, seedRng(FALLBACK_SEED), 1);
  if (opening !== null) return opening;
  const { cols, rows } = board.grid;
  throw new RangeError(`no opening fits a ${String(cols)} x ${String(rows)} board`);
}

/** The level's opening from the seeded stream: up to layoutAttempts tries, then the fallback. */
export function drawOpening(grid: Grid, knobs: DifficultyKnobs, rng: RngState): Opening {
  return drawOpeningWithin({ grid, knobs }, rng, TUNING.layoutAttempts);
}
