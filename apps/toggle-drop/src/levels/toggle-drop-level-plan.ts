// apps/toggle-drop/src/levels/toggle-drop-level-plan.ts
import { MAX_LEVEL_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { nextInt, seedRng } from '@e07/game-kit/rng/sfc32.ts';
import { applyMove } from '@e07/toggle-drop/rules/apply-move.ts';
import { create } from '@e07/toggle-drop/rules/create.ts';
import { listMoves } from '@e07/toggle-drop/rules/list-moves.ts';
import { outcome } from '@e07/toggle-drop/rules/outcome.ts';

import { TOGGLE_DROP_SOLVER } from './toggle-drop-solver.ts';

import type { LevelPlan } from '@e07/game-kit/levels/level-plan.ts';
import type { ToggleDropMove, ToggleDropState } from '@e07/toggle-drop/rules/toggle-drop-types.ts';

export const LEVELS_PER_PACK = 30;
const LAST_LEVEL = 3 * LEVELS_PER_PACK;
/** Seeded random playouts that judge how forgiving a board is (naive play should lose). */
const RANDOM_PLAYOUTS = 16;
/** Share of random playouts a level of pack 1, 2 and 3 may let win. */
const MAX_RANDOM_SHARES = [0.75, 0.5, 0.375] as const;

/** 0 at level 1, rising evenly to 99 at the last level; never falls. */
export function difficultyFor(level: number): number {
  const step = Math.min(Math.max(level, 1), LAST_LEVEL) - 1;
  return Math.floor((step * MAX_LEVEL_DIFFICULTY) / (LAST_LEVEL - 1));
}

/** The pack of a level, 0 to 2. */
function packOf(level: number): number {
  return Math.min(Math.max(Math.floor((level - 1) / LEVELS_PER_PACK), 0), 2);
}

/** Fewest drops a level of this pack must need: 2, 3, then 4 (no trivial levels later). */
export function minParFor(level: number): number {
  return 2 + packOf(level);
}

/** The share of random playouts a level of this pack may let win. */
export function maxRandomShareFor(level: number): number {
  return MAX_RANDOM_SHARES.reduce((picked, share, index) =>
    index === packOf(level) ? share : picked,
  );
}

/** One random playout: seeded drops until the run ends; true when it wins. */
function isRandomWin(start: ToggleDropState, seed: number): boolean {
  let state = start;
  let rng = seedRng(seed);
  for (let moves = listMoves(state); moves.length > 0; moves = listMoves(state)) {
    const draw = nextInt(rng, moves.length);
    rng = draw.state;
    state = applyMove(state, moves[draw.value] ?? { kind: 'drop', col: 0 }).state;
  }
  return outcome(state).kind === 'won';
}

/** The share of RANDOM_PLAYOUTS seeded random playouts that win the board. */
export function randomShare(start: ToggleDropState): number {
  const seeds = Array.from({ length: RANDOM_PLAYOUTS }, (_, index) => index + 1);
  return seeds.filter((seed) => isRandomWin(start, seed)).length / RANDOM_PLAYOUTS;
}

/**
 * The level table recipe. packages/tooling/src/levels/generate-levels.ts turns it into
 * pack-<n>.json: copy the plan, run the generator, commit the packs it writes (never copy packs).
 * A level needs its pack's minimum par and must not let random drops win too often.
 */
export const TOGGLE_DROP_LEVEL_PLAN: LevelPlan<ToggleDropState, ToggleDropMove> = {
  gameId: 'toggle-drop',
  packs: [
    { id: 'warm-up-board', nameId: 'toggle-drop.pack-name.1' },
    { id: 'switchyard', nameId: 'toggle-drop.pack-name.2' },
    { id: 'grand-cascade', nameId: 'toggle-drop.pack-name.3' },
  ],
  levelsPerPack: LEVELS_PER_PACK,
  difficultyFor,
  create,
  solver: TOGGLE_DROP_SOLVER,
  maxNodes: 60_000,
  maxTries: 60,
  rate: ({ level, par, start }) =>
    par >= minParFor(level) && randomShare(start) <= maxRandomShareFor(level)
      ? { kind: 'par', par }
      : null,
};
