// apps/scrap-shove/src/levels/scrap-shove-levels.ts
import { toLevelEntries } from '@e07/game-kit/levels/level-table.ts';
import { packsOf } from '@e07/game-kit/levels/plan-level-table.ts';

import pack1 from './pack-1.json';
import pack2 from './pack-2.json';
import pack3 from './pack-3.json';
import { SCRAP_SHOVE_LEVEL_PLAN } from './scrap-shove-level-plan.ts';
import { SCRAP_SHOVE_SOLVER } from './scrap-shove-solver.ts';

import type { LevelsSpec } from '@e07/game-kit/contract/levels.ts';
import type { ScrapShoveMove, ScrapShoveState } from '@e07/scrap-shove/rules/scrap-shove-types.ts';

/** This game's daily salt (the scaffold's suggestion): fixed forever, or every daily changes. */
export const SCRAP_SHOVE_DAILY_SALT = 0xd628;
/** Spec 8.3: the daily level uses a medium difficulty, 40 to 50 on the 0..99 level scale. */
export const SCRAP_SHOVE_DAILY_DIFFICULTY = 45;

/**
 * Spec 10 LEVELS: the committed tables (written by generate-levels.ts, never by hand) and the
 * modes. Levels + Daily (8.2); Scrap Shove has no endless mode, so game.config.ts modes.endless is
 * false.
 */
export const SCRAP_SHOVE_LEVELS: LevelsSpec<ScrapShoveState, ScrapShoveMove> = {
  difficultyFor: SCRAP_SHOVE_LEVEL_PLAN.difficultyFor,
  packs: packsOf(SCRAP_SHOVE_LEVEL_PLAN),
  table: [pack1, pack2, pack3].flatMap((pack) => toLevelEntries(pack)),
  solver: SCRAP_SHOVE_SOLVER,
  daily: { kind: 'daily', difficulty: SCRAP_SHOVE_DAILY_DIFFICULTY, salt: SCRAP_SHOVE_DAILY_SALT },
  endless: { kind: 'none' },
};
