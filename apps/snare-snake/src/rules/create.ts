// apps/snare-snake/src/rules/create.ts
// Spec 10 RULES "Start state for a level (from its seed and difficulty)"; spec 8.1: the same seed
// always makes the same level. Difficulty 0..100 (clamped) picks the tuning row; the opening is
// the design fix's coil around a nest of critters (opening.ts).
import { clampDifficulty } from '@e07/game-kit/contract/difficulty.ts';
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { drawOpening } from './opening.ts';
import { knobsFor } from './snare-snake-tuning.ts';

import type { SnareSnakeState } from './snare-snake-types.ts';

export function create(seed: number, difficulty: number): SnareSnakeState {
  const level = clampDifficulty(difficulty);
  const knobs = knobsFor(level);
  const grid = { cols: knobs.cols, rows: knobs.rows };
  const opening = drawOpening(grid, knobs, seedRng(seed));
  return {
    difficulty: level,
    cols: grid.cols,
    rows: grid.rows,
    snake: opening.snake,
    critters: opening.critters,
    total: opening.critters.length,
    caught: 0,
    growth: 0,
    moves: 0,
    maxMoves: knobs.maxMoves,
    score: 0,
    hasContinued: false,
    rng: opening.rng,
  };
}
