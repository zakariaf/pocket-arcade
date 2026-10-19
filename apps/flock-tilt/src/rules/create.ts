// apps/flock-tilt/src/rules/create.ts
// Start state from (seed, difficulty), the same on every phone (spec 8.1, 8.3). Fields are drawn
// from the seeded sfc32 stream and kept only when the breadth-first search wins them inside the
// tuning row's par band, so every field, the daily included, can be won, and the state carries par.
import { nextInt, nextU32, seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { solveField } from './field-search.ts';
import { TUNING, knobsFor } from './flock-tilt-tuning.ts';
import { DIRECTIONS, stepFrom } from './tilt-field.ts';

import type { DifficultyKnobs } from './flock-tilt-tuning.ts';
import type { Field, FlockTiltState } from './flock-tilt-types.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

type Drawn = { readonly field: Field | null; readonly rng: RngState };

/** All cells of the field in a seeded random order: each cell draws a key, then sort by key. */
function shuffledCells(rng: RngState, size: number): { cells: number[]; rng: RngState } {
  const keyed: { readonly cell: number; readonly key: number }[] = [];
  let state = rng;
  for (let cell = 0; cell < size; cell += 1) {
    const draw = nextU32(state);
    state = draw.state;
    keyed.push({ cell, key: draw.value });
  }
  keyed.sort((a, b) => (a.key === b.key ? a.cell - b.cell : a.key - b.key));
  return { cells: keyed.map((entry) => entry.cell), rng: state };
}

/** True when a sheep stands next to a wolf on any of its four sides. */
function hasSheepByWolf(field: Field): boolean {
  const wolfCells = field.wolves.map((wolf) => wolf.cell);
  return field.sheep.some((sheep) =>
    DIRECTIONS.some((direction) => wolfCells.includes(stepFrom(field, sheep.cell, direction))),
  );
}

/** One candidate field: rocks, then the pen, the sheep and the wolves on the shuffled cells. */
function drawField(rng: RngState, knobs: DifficultyKnobs): Drawn {
  const side = TUNING.side;
  const shuffled = shuffledCells(rng, side * side);
  const rockDraw = nextInt(shuffled.rng, knobs.maxRocks - knobs.minRocks + 1);
  const rockCount = knobs.minRocks + rockDraw.value;
  const { cells } = shuffled;
  const pen = cells.reduce((found, cell, index) => (index === rockCount ? cell : found), -1);
  const firstSheep = rockCount + 1;
  const firstWolf = firstSheep + knobs.sheep;
  const field: Field = {
    cols: side,
    rows: side,
    rocks: cells.slice(0, rockCount).sort((a, b) => a - b),
    pen,
    sheep: cells.slice(firstSheep, firstWolf).map((cell, id) => ({ id, cell, status: 'field' })),
    wolves: cells.slice(firstWolf, firstWolf + knobs.wolves).map((cell, id) => ({ id, cell })),
  };
  return { field: hasSheepByWolf(field) ? null : field, rng: rockDraw.state };
}

/**
 * The prepared field when no draw is kept (never seen in practice; create.test proves it): the pen
 * in the top-left corner, the sheep in the top row beside it, rocks in the middle row and the wolves
 * in the bottom row. One tilt to the left pens every sheep.
 */
function fallbackField(knobs: DifficultyKnobs): Field {
  const side = TUNING.side;
  const middle = Math.floor(side / 2) * side;
  const bottomEnd = side * side - 1;
  return {
    cols: side,
    rows: side,
    rocks: Array.from({ length: knobs.minRocks }, (_, index) => middle + index),
    pen: 0,
    sheep: Array.from({ length: knobs.sheep }, (_, id) => ({ id, cell: id + 1, status: 'field' })),
    wolves: Array.from({ length: knobs.wolves }, (_, id) => ({ id, cell: bottomEnd - 2 * id })),
  };
}

function startState(field: Field, par: number): FlockTiltState {
  return {
    ...field,
    tilts: 0,
    tiltLimit: TUNING.tiltLimit,
    par,
    hasContinued: false,
    beforeLoss: null,
  };
}

/** create with an explicit number of draws (tests reach the prepared fallback field with 0). */
export function createWithin(
  seed: number,
  difficulty: number,
  drawAttempts: number,
): FlockTiltState {
  const knobs = knobsFor(difficulty);
  let rng = seedRng(seed);
  for (let attempt = 0; attempt < drawAttempts; attempt += 1) {
    const drawn = drawField(rng, knobs);
    rng = drawn.rng;
    const field = drawn.field;
    const solution = field === null ? null : solveField(field, knobs.maxPar, TUNING.searchNodes);
    if (field !== null && solution !== null && solution.par >= knobs.minPar) {
      return startState(field, solution.par);
    }
  }
  return startState(fallbackField(knobs), 1);
}

/** Start state from (seed, difficulty): the same pair gives the same field on every phone. */
export function create(seed: number, difficulty: number): FlockTiltState {
  return createWithin(seed, difficulty, TUNING.drawAttempts);
}
