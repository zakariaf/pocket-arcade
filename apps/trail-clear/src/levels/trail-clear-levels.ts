// apps/trail-clear/src/levels/trail-clear-levels.ts
import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { toLevelEntries } from '@e07/game-kit/levels/level-table.ts';
import { packsOf } from '@e07/game-kit/levels/plan-level-table.ts';

import pack1 from './pack-1.json';
import pack2 from './pack-2.json';
import pack3 from './pack-3.json';
import { TRAIL_CLEAR_LEVEL_PLAN } from './trail-clear-level-plan.ts';
import { TRAIL_CLEAR_SOLVER } from './trail-clear-solver.ts';

import type { LevelsSpec } from '@e07/game-kit/contract/levels.ts';
import type { TrailClearMove, TrailClearState } from '@e07/trail-clear/rules/trail-clear-types.ts';

/** This game's daily salt (the scaffold's suggestion, 2026-10-19): fixed forever, never shared. */
export const TRAIL_CLEAR_DAILY_SALT = 0xe8ed;
/** Spec 8.3: the daily level uses a medium difficulty (45: the second of the four level rows). */
export const TRAIL_CLEAR_DAILY_DIFFICULTY = 45;

/**
 * Spec 10 LEVELS: the committed tables (written by generate-levels.ts, never by hand) and the
 * modes. daily and endless match game.config.ts modes exactly (check-levels daily-mode and
 * endless-mode): the endless run is create(freshSeed, ENDLESS_DIFFICULTY).
 */
export const TRAIL_CLEAR_LEVELS: LevelsSpec<TrailClearState, TrailClearMove> = {
  difficultyFor: TRAIL_CLEAR_LEVEL_PLAN.difficultyFor,
  packs: packsOf(TRAIL_CLEAR_LEVEL_PLAN),
  table: [pack1, pack2, pack3].flatMap((pack) => toLevelEntries(pack)),
  solver: TRAIL_CLEAR_SOLVER,
  daily: { kind: 'daily', difficulty: TRAIL_CLEAR_DAILY_DIFFICULTY, salt: TRAIL_CLEAR_DAILY_SALT },
  endless: { kind: 'endless', difficulty: ENDLESS_DIFFICULTY },
};
