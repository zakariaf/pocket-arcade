// apps/swap-guard/src/levels/swap-guard-levels.ts
import { toLevelEntries } from '@e07/game-kit/levels/level-table.ts';
import { packsOf } from '@e07/game-kit/levels/plan-level-table.ts';

import pack1 from './pack-1.json';
import pack2 from './pack-2.json';
import pack3 from './pack-3.json';
import { SWAP_GUARD_LEVEL_PLAN } from './swap-guard-level-plan.ts';
import { SWAP_GUARD_SOLVER } from './swap-guard-solver.ts';

import type { LevelsSpec } from '@e07/game-kit/contract/levels.ts';
import type { SwapGuardMove, SwapGuardState } from '@e07/swap-guard/rules/swap-guard-types.ts';

/** This game's daily salt (the scaffold's suggestion, E25-T03): fixed forever. */
export const SWAP_GUARD_DAILY_SALT = 0x8790;
/** Spec 8.3: the daily level uses a medium difficulty: 45, the second tuning row. */
export const SWAP_GUARD_DAILY_DIFFICULTY = 45;

/**
 * Spec 10 LEVELS: the committed tables (written by generate-levels.ts, never by hand) and the
 * modes. daily and endless match game.config.ts modes exactly: daily on, no endless.
 */
export const SWAP_GUARD_LEVELS: LevelsSpec<SwapGuardState, SwapGuardMove> = {
  difficultyFor: SWAP_GUARD_LEVEL_PLAN.difficultyFor,
  packs: packsOf(SWAP_GUARD_LEVEL_PLAN),
  table: [pack1, pack2, pack3].flatMap((pack) => toLevelEntries(pack)),
  solver: SWAP_GUARD_SOLVER,
  daily: { kind: 'daily', difficulty: SWAP_GUARD_DAILY_DIFFICULTY, salt: SWAP_GUARD_DAILY_SALT },
  endless: { kind: 'none' },
};
