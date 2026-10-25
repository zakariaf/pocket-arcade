// apps/snare-snake/src/levels/snare-snake-levels.ts
import { toLevelEntries } from '@e07/game-kit/levels/level-table.ts';
import { packsOf } from '@e07/game-kit/levels/plan-level-table.ts';

import pack1 from './pack-1.json';
import pack2 from './pack-2.json';
import pack3 from './pack-3.json';
import { SNARE_SNAKE_LEVEL_PLAN } from './snare-snake-level-plan.ts';
import { SNARE_SNAKE_SOLVER } from './snare-snake-solver.ts';

import type { LevelsSpec } from '@e07/game-kit/contract/levels.ts';
import type { SnareSnakeMove, SnareSnakeState } from '@e07/snare-snake/rules/snare-snake-types.ts';

/** This game's daily salt (the new-game scaffold's suggestion for snare-snake): fixed forever. */
export const SNARE_SNAKE_DAILY_SALT = 0x36d5;
/** Spec 8.3: the daily level uses a medium difficulty (45: the second of the four level rows). */
export const SNARE_SNAKE_DAILY_DIFFICULTY = 45;

/**
 * Spec 10 LEVELS: the committed tables (written by generate-levels.ts, never by hand) and the
 * modes. daily and endless match game.config.ts modes exactly (check-levels daily-mode and
 * endless-mode): Snare Snake has a daily challenge and no endless run.
 */
export const SNARE_SNAKE_LEVELS: LevelsSpec<SnareSnakeState, SnareSnakeMove> = {
  difficultyFor: SNARE_SNAKE_LEVEL_PLAN.difficultyFor,
  packs: packsOf(SNARE_SNAKE_LEVEL_PLAN),
  table: [pack1, pack2, pack3].flatMap((pack) => toLevelEntries(pack)),
  solver: SNARE_SNAKE_SOLVER,
  daily: { kind: 'daily', difficulty: SNARE_SNAKE_DAILY_DIFFICULTY, salt: SNARE_SNAKE_DAILY_SALT },
  endless: { kind: 'none' },
};
