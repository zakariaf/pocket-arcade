// apps/flock-tilt/src/levels/flock-tilt-levels.ts
import { toLevelEntries } from '@e07/game-kit/levels/level-table.ts';
import { packsOf } from '@e07/game-kit/levels/plan-level-table.ts';

import { FLOCK_TILT_LEVEL_PLAN } from './flock-tilt-level-plan.ts';
import { FLOCK_TILT_SOLVER } from './flock-tilt-solver.ts';
import pack1 from './pack-1.json';
import pack2 from './pack-2.json';
import pack3 from './pack-3.json';

import type { FlockTiltMove, FlockTiltState } from '@e07/flock-tilt/rules/flock-tilt-types.ts';
import type { LevelsSpec } from '@e07/game-kit/contract/levels.ts';

/** This game's daily salt (new-game-scaffold's suggestion): fixed forever, never shared. */
export const FLOCK_TILT_DAILY_SALT = 0x9c3b;
/** Spec 8.3: the daily level uses a medium difficulty; 45 is the second tuning row (4 sheep). */
export const FLOCK_TILT_DAILY_DIFFICULTY = 45;

/**
 * Spec 10 LEVELS: the committed tables (written by generate-levels.ts, never by hand) and the
 * modes, matching game.config.ts: a daily, no endless run.
 */
export const FLOCK_TILT_LEVELS: LevelsSpec<FlockTiltState, FlockTiltMove> = {
  difficultyFor: FLOCK_TILT_LEVEL_PLAN.difficultyFor,
  packs: packsOf(FLOCK_TILT_LEVEL_PLAN),
  table: [pack1, pack2, pack3].flatMap((pack) => toLevelEntries(pack)),
  solver: FLOCK_TILT_SOLVER,
  daily: { kind: 'daily', difficulty: FLOCK_TILT_DAILY_DIFFICULTY, salt: FLOCK_TILT_DAILY_SALT },
  endless: { kind: 'none' },
};
