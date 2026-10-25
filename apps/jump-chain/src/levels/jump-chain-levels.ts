// apps/jump-chain/src/levels/jump-chain-levels.ts
import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { toLevelEntries } from '@e07/game-kit/levels/level-table.ts';
import { packsOf } from '@e07/game-kit/levels/plan-level-table.ts';

import { JUMP_CHAIN_LEVEL_PLAN } from './jump-chain-level-plan.ts';
import { JUMP_CHAIN_SOLVER } from './jump-chain-solver.ts';
import pack1 from './pack-1.json';
import pack2 from './pack-2.json';
import pack3 from './pack-3.json';

import type { LevelsSpec } from '@e07/game-kit/contract/levels.ts';
import type { JumpChainMove, JumpChainState } from '@e07/jump-chain/rules/jump-chain-types.ts';

/** This game's daily salt (the new-game scaffold's suggestion for jump-chain): fixed forever. */
export const JUMP_CHAIN_DAILY_SALT = 0x748e;
/** Spec 8.3: the daily level uses a medium difficulty (45: the second of the four level rows). */
export const JUMP_CHAIN_DAILY_DIFFICULTY = 45;

/**
 * Spec 10 LEVELS: the committed tables (written by generate-levels.ts, never by hand) and the
 * modes. daily and endless match game.config.ts modes exactly (check-levels daily-mode and
 * endless-mode): the endless run is create(freshSeed, ENDLESS_DIFFICULTY).
 */
export const JUMP_CHAIN_LEVELS: LevelsSpec<JumpChainState, JumpChainMove> = {
  difficultyFor: JUMP_CHAIN_LEVEL_PLAN.difficultyFor,
  packs: packsOf(JUMP_CHAIN_LEVEL_PLAN),
  table: [pack1, pack2, pack3].flatMap((pack) => toLevelEntries(pack)),
  solver: JUMP_CHAIN_SOLVER,
  daily: { kind: 'daily', difficulty: JUMP_CHAIN_DAILY_DIFFICULTY, salt: JUMP_CHAIN_DAILY_SALT },
  endless: { kind: 'endless', difficulty: ENDLESS_DIFFICULTY },
};
