// apps/__GAME_ID__/src/levels/__GAME_ID__-levels.ts
import { toLevelEntries } from '@e07/game-kit/levels/level-table.ts';
import { packsOf } from '@e07/game-kit/levels/plan-level-table.ts';

import pack1 from './pack-1.json';
import pack2 from './pack-2.json';
import pack3 from './pack-3.json';
import { __GAME_CONST___LEVEL_PLAN } from './__GAME_ID__-level-plan.ts';
import { __GAME_CONST___SOLVER } from './__GAME_ID__-solver.ts';

import type { LevelsSpec } from '@e07/game-kit/contract/levels.ts';
import type { __GAME_PASCAL__Move, __GAME_PASCAL__State } from '@e07/__GAME_ID__/rules/__GAME_ID__-types.ts';

/** This game's daily salt: fixed forever, or every player's daily level changes. */
export const __GAME_CONST___DAILY_SALT = 0x5446;
/** Spec 8.3: the daily level uses a medium difficulty, 40 to 50 on the 0..99 level scale. */
export const __GAME_CONST___DAILY_DIFFICULTY = 40;

/**
 * Spec 10 LEVELS: the committed tables (written by generate-levels.ts, never by hand) and the
 * modes. daily and endless match game.config.ts modes exactly (check-levels daily-mode and
 * endless-mode). Tap Flip has no endless mode; a game with one sets
 * endless: { kind: 'endless', difficulty: ENDLESS_DIFFICULTY } (100, from contract/difficulty.ts).
 */
export const __GAME_CONST___LEVELS: LevelsSpec<__GAME_PASCAL__State, __GAME_PASCAL__Move> = {
  difficultyFor: __GAME_CONST___LEVEL_PLAN.difficultyFor,
  packs: packsOf(__GAME_CONST___LEVEL_PLAN),
  table: [pack1, pack2, pack3].flatMap((pack) => toLevelEntries(pack)),
  solver: __GAME_CONST___SOLVER,
  daily: { kind: 'daily', difficulty: __GAME_CONST___DAILY_DIFFICULTY, salt: __GAME_CONST___DAILY_SALT },
  endless: { kind: 'none' },
};
