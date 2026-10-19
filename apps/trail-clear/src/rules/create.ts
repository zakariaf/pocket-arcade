// apps/trail-clear/src/rules/create.ts
// Spec 10 RULES "Start state for a level (from its seed and difficulty)"; spec 8.1: the same seed
// always makes the same level. Difficulty 0..99 is a level row, 100 the endless run.
import { clampDifficulty } from '@e07/game-kit/contract/difficulty.ts';
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { drawOpening, openingCells } from './opening.ts';

import type { TrailClearState } from './trail-clear-types.ts';

export function create(seed: number, difficulty: number): TrailClearState {
  const start = drawOpening(seedRng(seed));
  return {
    difficulty: clampDifficulty(difficulty),
    cells: openingCells(start.opening),
    offered: start.opening.firstTile,
    placements: 0,
    score: 0,
    loopsClosed: 0,
    hasContinued: false,
    rng: start.rng,
  };
}
