// apps/merge-siege/src/rules/create.ts
// Spec 10 RULES "Start state for a level (from its seed and difficulty)"; spec 8.1: the same seed
// always makes the same level. Difficulty 0..99 is a level row, 100 the endless run.
import { clampDifficulty } from '@e07/game-kit/contract/difficulty.ts';
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { drawNextEnemy } from './next-enemy.ts';
import { drawOpening, openingCells } from './opening.ts';

import type { MergeSiegeState } from './merge-siege-types.ts';

export function create(seed: number, difficulty: number): MergeSiegeState {
  const level = clampDifficulty(difficulty);
  const start = drawOpening(seedRng(seed));
  const opening = openingCells(start.opening);
  const first = drawNextEnemy({ rng: start.rng, difficulty: level, swipes: 0 });
  return {
    difficulty: level,
    cells: opening.cells,
    next: first.next,
    swipes: 0,
    entered: opening.enemies,
    smashed: 0,
    score: 0,
    nextId: opening.nextId,
    hasContinued: false,
    rng: first.rng,
  };
}
