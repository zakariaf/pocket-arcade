// apps/__GAME_ID__/src/levels/__GAME_ID__-level-plan.ts
import { create } from '@e07/__GAME_ID__/rules/create.ts';

import { __GAME_CONST___SOLVER } from './__GAME_ID__-solver.ts';

import type { LevelPlan } from '@e07/game-kit/levels/level-plan.ts';
import type { __GAME_PASCAL__Move, __GAME_PASCAL__State } from '@e07/__GAME_ID__/rules/__GAME_ID__-types.ts';

export const LEVELS_PER_PACK = 30;
/**
 * The top of this game's curve. Most games rise to MAX_LEVEL_DIFFICULTY (99); Tap Flip stops at
 * 60 (4x4 boards, 8 scramble presses), because larger boards cost the exact solver too much to
 * prove and give par levels no player enjoys.
 */
export const LEVEL_DIFFICULTY_CAP = 60;
const LAST_LEVEL = 3 * LEVELS_PER_PACK;

/** 0 at level 1, rising evenly to LEVEL_DIFFICULTY_CAP at the last level; never falls. */
export function difficultyFor(level: number): number {
  const step = Math.min(Math.max(level, 1), LAST_LEVEL) - 1;
  return Math.floor((step * LEVEL_DIFFICULTY_CAP) / (LAST_LEVEL - 1));
}

/** Fewest presses a level of this pack must need: 2, 3, then 4 (no trivial levels later). */
export function minParFor(level: number): number {
  return 2 + Math.floor((level - 1) / LEVELS_PER_PACK);
}

/**
 * The level table recipe. packages/tooling/src/levels/generate-levels.ts turns it into
 * pack-<n>.json: copy the plan, run the generator, commit the packs it writes (never copy packs).
 */
export const __GAME_CONST___LEVEL_PLAN: LevelPlan<__GAME_PASCAL__State, __GAME_PASCAL__Move> = {
  gameId: '__GAME_ID__',
  packs: [
    { id: 'first-sparks', nameId: '__GAME_ID__.pack-name.1' },
    { id: 'night-shift', nameId: '__GAME_ID__.pack-name.2' },
    { id: 'lights-out', nameId: '__GAME_ID__.pack-name.3' },
  ],
  levelsPerPack: LEVELS_PER_PACK,
  difficultyFor,
  create,
  solver: __GAME_CONST___SOLVER,
  maxNodes: 60_000,
  maxTries: 50,
  rate: ({ level, par }) => (par >= minParFor(level) ? { kind: 'par', par } : null),
};
