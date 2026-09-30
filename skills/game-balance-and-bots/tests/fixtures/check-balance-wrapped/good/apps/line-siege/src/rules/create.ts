// apps/line-siege/src/rules/create.ts
// Spec 10 RULES "Start state for a level (from its seed and difficulty)"; spec 8.1: the same seed
// always makes the same level. Difficulty 0..99 is a level row, 100 the endless run.
import { clampDifficulty } from '@e07/game-kit/contract/difficulty.ts';
import { nextInt, seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { TUNING } from './line-siege-tuning.ts';
import { drawOpening, openingCells, openingMonsters, scatter } from './opening.ts';
import { HORIZONTAL_TWO, PIECES, VERTICAL_TWO } from './pieces.ts';

import type { LineSiegeState } from './line-siege-types.ts';

export function create(seed: number, difficulty: number): LineSiegeState {
  const level = clampDifficulty(difficulty);
  const start = drawOpening(seedRng(seed));
  const board = scatter(openingCells(start.opening), start.opening, start.rng);
  const cast = openingMonsters(start.opening, level, board.rng);
  const free = nextInt(cast.rng, PIECES.length);
  return {
    difficulty: level,
    cells: board.cells,
    tray: [free.value, VERTICAL_TWO, HORIZONTAL_TWO],
    monsters: cast.monsters,
    hearts: TUNING.hearts,
    placements: 0,
    spawned: cast.monsters.length,
    defeated: 0,
    score: 0,
    nextId: cast.monsters.length + 1,
    rng: free.state,
  };
}
