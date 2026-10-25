// apps/toggle-drop/src/levels/toggle-drop-levels.ts
import { toLevelEntries } from '@e07/game-kit/levels/level-table.ts';
import { packsOf } from '@e07/game-kit/levels/plan-level-table.ts';

import pack1 from './pack-1.json';
import pack2 from './pack-2.json';
import pack3 from './pack-3.json';
import { TOGGLE_DROP_LEVEL_PLAN } from './toggle-drop-level-plan.ts';
import { TOGGLE_DROP_SOLVER } from './toggle-drop-solver.ts';

import type { LevelsSpec } from '@e07/game-kit/contract/levels.ts';
import type { ToggleDropMove, ToggleDropState } from '@e07/toggle-drop/rules/toggle-drop-types.ts';

/** This game's daily salt: fixed forever, or every player's daily level changes. */
export const TOGGLE_DROP_DAILY_SALT = 0xcbcb;
/** Spec 8.3: the daily level uses a medium difficulty, 40 to 50 on the 0..99 level scale. */
export const TOGGLE_DROP_DAILY_DIFFICULTY = 45;

/**
 * Spec 10 LEVELS: the committed tables (written by generate-levels.ts, never by hand) and the
 * modes. daily and endless match game.config.ts modes exactly (check-levels daily-mode and
 * endless-mode). Toggle Drop has no endless mode: a board ends when its cups are full. Its daily
 * salt 0xcbcb is the scaffold's suggestion, fixed forever; the daily plays the second tuning row.
 */
export const TOGGLE_DROP_LEVELS: LevelsSpec<ToggleDropState, ToggleDropMove> = {
  difficultyFor: TOGGLE_DROP_LEVEL_PLAN.difficultyFor,
  packs: packsOf(TOGGLE_DROP_LEVEL_PLAN),
  table: [pack1, pack2, pack3].flatMap((pack) => toLevelEntries(pack)),
  solver: TOGGLE_DROP_SOLVER,
  daily: { kind: 'daily', difficulty: TOGGLE_DROP_DAILY_DIFFICULTY, salt: TOGGLE_DROP_DAILY_SALT },
  endless: { kind: 'none' },
};
