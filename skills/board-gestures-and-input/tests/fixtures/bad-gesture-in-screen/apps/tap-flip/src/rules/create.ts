// apps/tap-flip/src/rules/create.ts
import { clampDifficulty } from '@e07/game-kit/contract/difficulty.ts';
import { nextInt, seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { flipCells, neighbourhood } from './flip-cells.ts';

import type { Cell, TapFlipState } from './tap-flip-types.ts';

const MIN_SIDE = 3;
const MAX_SIDE = 6;
const MIN_PRESSES = 2;
/** The player gets this many moves per scramble press. */
const MOVES_PER_PRESS = 3;

/**
 * Grid side 3..6 and 2..12 scramble presses, both rising with the difficulty (0..100, clamped).
 * Tap Flip has no endless mode, so 100 is simply the hardest shape; its levels stop at 60.
 */
export function shapeFor(difficulty: number): { readonly side: number; readonly presses: number } {
  const level = clampDifficulty(difficulty);
  const side = MIN_SIDE + Math.floor((level * (MAX_SIDE - MIN_SIDE)) / 100);
  return { side, presses: MIN_PRESSES + Math.floor(level / 10) };
}

/**
 * Start state from (seed, difficulty): the same pair gives the same board on every phone.
 * The board is scrambled by pressing seeded cells of a dark grid, so it is always solvable
 * in at most `presses` moves (a press undoes itself).
 */
export function create(seed: number, difficulty: number): TapFlipState {
  const { side, presses } = shapeFor(difficulty);
  const size = side * side;
  let rng = seedRng(seed);
  let cells: Cell[] = Array.from({ length: size }, (): Cell => 0);
  for (let press = 0; press < presses; press += 1) {
    const draw = nextInt(rng, size);
    rng = draw.state;
    cells = flipCells(cells, neighbourhood(side, side, draw.value));
  }
  if (cells.every((cell) => cell === 0)) cells = flipCells(cells, neighbourhood(side, side, 0));
  return { cols: side, rows: side, cells, moves: 0, maxMoves: presses * MOVES_PER_PRESS };
}
