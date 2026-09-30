// apps/__GAME_ID__/src/rules/create.ts
import { nextInt, seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { flipCells, neighbourhood } from './flip-cells.ts';
import { TUNING, knobsFor, pressesFor } from './__GAME_ID__-tuning.ts';

import type { Cell, __GAME_PASCAL__State } from './__GAME_ID__-types.ts';

/**
 * Board side (3, 4 or 5 by tuning row) and 2..12 scramble presses, both rising with the difficulty
 * (0..100, clamped). Tap Flip has no endless mode, so 100 is simply the hardest shape; its levels
 * stop at 60. Every number comes from the tuning file.
 */
export function shapeFor(difficulty: number): { readonly side: number; readonly presses: number } {
  return { side: knobsFor(difficulty).side, presses: pressesFor(difficulty) };
}

/**
 * Start state from (seed, difficulty): the same pair gives the same board on every phone.
 * The board is scrambled by pressing seeded cells of a dark grid, so it is always solvable
 * in at most `presses` moves (a press undoes itself).
 */
export function create(seed: number, difficulty: number): __GAME_PASCAL__State {
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
  return { cols: side, rows: side, cells, moves: 0, maxMoves: presses * TUNING.movesPerPress };
}
