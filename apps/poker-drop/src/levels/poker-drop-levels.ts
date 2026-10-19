// apps/poker-drop/src/levels/poker-drop-levels.ts
import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { toLevelEntries } from '@e07/game-kit/levels/level-table.ts';
import { packsOf } from '@e07/game-kit/levels/plan-level-table.ts';

import pack1 from './pack-1.json';
import pack2 from './pack-2.json';
import pack3 from './pack-3.json';
import { POKER_DROP_LEVEL_PLAN } from './poker-drop-level-plan.ts';
import { POKER_DROP_SOLVER } from './poker-drop-solver.ts';

import type { LevelsSpec } from '@e07/game-kit/contract/levels.ts';
import type { PokerDropMove, PokerDropState } from '@e07/poker-drop/rules/poker-drop-types.ts';

/** This game's daily salt (the scaffold's suggestion for 'poker-drop'): fixed forever. */
export const POKER_DROP_DAILY_SALT = 0x4ef1;
/** Spec 8.3: the daily level uses a medium difficulty (45: the second of the four level rows). */
export const POKER_DROP_DAILY_DIFFICULTY = 45;

/**
 * Spec 10 LEVELS: the committed tables (written by generate-levels.ts, never by hand) and the
 * modes. daily and endless match game.config.ts modes exactly (check-levels daily-mode and
 * endless-mode): the endless run is create(freshSeed, ENDLESS_DIFFICULTY).
 */
export const POKER_DROP_LEVELS: LevelsSpec<PokerDropState, PokerDropMove> = {
  difficultyFor: POKER_DROP_LEVEL_PLAN.difficultyFor,
  packs: packsOf(POKER_DROP_LEVEL_PLAN),
  table: [pack1, pack2, pack3].flatMap((pack) => toLevelEntries(pack)),
  solver: POKER_DROP_SOLVER,
  daily: { kind: 'daily', difficulty: POKER_DROP_DAILY_DIFFICULTY, salt: POKER_DROP_DAILY_SALT },
  endless: { kind: 'endless', difficulty: ENDLESS_DIFFICULTY },
};
