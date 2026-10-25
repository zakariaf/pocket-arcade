// apps/stepstone/src/levels/stepstone-levels.ts
import { toLevelEntries } from '@e07/game-kit/levels/level-table.ts';
import { packsOf } from '@e07/game-kit/levels/plan-level-table.ts';

import pack1 from './pack-1.json';
import pack2 from './pack-2.json';
import pack3 from './pack-3.json';
import { STEPSTONE_LEVEL_PLAN } from './stepstone-level-plan.ts';
import { STEPSTONE_SOLVER } from './stepstone-solver.ts';

import type { LevelsSpec } from '@e07/game-kit/contract/levels.ts';
import type { StepstoneMove, StepstoneState } from '@e07/stepstone/rules/stepstone-types.ts';

/** Stepstone's daily salt (the scaffold's suggestion for the id): fixed forever (spec 8.3). */
export const STEPSTONE_DAILY_SALT = 0x0eb2;
/** Spec 8.3: the daily level uses a medium difficulty: 45, in the second of four tuning rows. */
export const STEPSTONE_DAILY_DIFFICULTY = 45;

/**
 * Spec 10 LEVELS: the committed tables (written by generate-levels.ts, never by hand) and the
 * modes, matching game.config.ts: a daily, no endless run.
 */
export const STEPSTONE_LEVELS: LevelsSpec<StepstoneState, StepstoneMove> = {
  difficultyFor: STEPSTONE_LEVEL_PLAN.difficultyFor,
  packs: packsOf(STEPSTONE_LEVEL_PLAN),
  table: [pack1, pack2, pack3].flatMap((pack) => toLevelEntries(pack)),
  solver: STEPSTONE_SOLVER,
  daily: { kind: 'daily', difficulty: STEPSTONE_DAILY_DIFFICULTY, salt: STEPSTONE_DAILY_SALT },
  endless: { kind: 'none' },
};
