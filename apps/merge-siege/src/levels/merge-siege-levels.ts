// apps/merge-siege/src/levels/merge-siege-levels.ts
import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { toLevelEntries } from '@e07/game-kit/levels/level-table.ts';
import { packsOf } from '@e07/game-kit/levels/plan-level-table.ts';

import { MERGE_SIEGE_LEVEL_PLAN } from './merge-siege-level-plan.ts';
import { MERGE_SIEGE_SOLVER } from './merge-siege-solver.ts';
import pack1 from './pack-1.json';
import pack2 from './pack-2.json';
import pack3 from './pack-3.json';

import type { LevelsSpec } from '@e07/game-kit/contract/levels.ts';
import type { MergeSiegeMove, MergeSiegeState } from '@e07/merge-siege/rules/merge-siege-types.ts';

/** This game's daily salt (the scaffold's FNV-1a of 'merge-siege' folded to 16 bits): fixed forever. */
export const MERGE_SIEGE_DAILY_SALT = 0x7403;
/** Spec 8.3: the daily level uses a medium difficulty (45: the second of the four level rows). */
export const MERGE_SIEGE_DAILY_DIFFICULTY = 45;

/**
 * Spec 10 LEVELS: the committed tables (written by generate-levels.ts, never by hand) and the
 * modes. daily and endless match game.config.ts modes exactly (check-levels daily-mode and
 * endless-mode): the endless run is create(freshSeed, ENDLESS_DIFFICULTY).
 */
export const MERGE_SIEGE_LEVELS: LevelsSpec<MergeSiegeState, MergeSiegeMove> = {
  difficultyFor: MERGE_SIEGE_LEVEL_PLAN.difficultyFor,
  packs: packsOf(MERGE_SIEGE_LEVEL_PLAN),
  table: [pack1, pack2, pack3].flatMap((pack) => toLevelEntries(pack)),
  solver: MERGE_SIEGE_SOLVER,
  daily: { kind: 'daily', difficulty: MERGE_SIEGE_DAILY_DIFFICULTY, salt: MERGE_SIEGE_DAILY_SALT },
  endless: { kind: 'endless', difficulty: ENDLESS_DIFFICULTY },
};
