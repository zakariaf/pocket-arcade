// apps/swap-guard/src/index.ts
import { GAME_ART } from '@e07/swap-guard/art/game-art.ts';
import { swapGuardBoard } from '@e07/swap-guard/board/swap-guard-board.ts';
import ckb from '@e07/swap-guard/i18n/ckb.json';
import de from '@e07/swap-guard/i18n/de.json';
import en from '@e07/swap-guard/i18n/en.json';
import fa from '@e07/swap-guard/i18n/fa.json';
import { SWAP_GUARD_LEVELS } from '@e07/swap-guard/levels/swap-guard-levels.ts';
import { SWAP_GUARD_ENGINE, SWAP_GUARD_RULES } from '@e07/swap-guard/rules/swap-guard-engine.ts';
import { SWAP_GUARD_PERSISTENCE } from '@e07/swap-guard/rules/swap-guard-persistence.ts';
import { SWAP_GUARD_STATS } from '@e07/swap-guard/rules/swap-guard-stats.ts';
import { SOUND_BANK } from '@e07/swap-guard/sounds/sound-bank.ts';
import { SWAP_GUARD_TESTING } from '@e07/swap-guard/testing/swap-guard-testing.ts';
import { PALETTE } from '@e07/swap-guard/theme/palette.ts';
import { SWAP_GUARD_TEACHING } from '@e07/swap-guard/tutorial/swap-guard-teaching.ts';

import type { SwapGuardTypes } from './swap-guard-types.ts';
import type { ShellGameModule } from '@e07/shell/game-host/shell-game-module.ts';

/** The game as the Shell sees it (spec section 10). Assembly only; no logic here. */
export const swapGuardGame: ShellGameModule<SwapGuardTypes> = {
  identity: {
    id: 'swap-guard',
    nameId: 'swap-guard.name',
    winTitleId: 'swap-guard.win-title',
    taglineId: 'swap-guard.tagline',
  },
  engine: SWAP_GUARD_ENGINE,
  rules: SWAP_GUARD_RULES,
  levels: SWAP_GUARD_LEVELS,
  presentation: {
    board: swapGuardBoard,
    art: GAME_ART,
    sounds: SOUND_BANK,
    palette: PALETTE,
  },
  realtime: null,
  teaching: SWAP_GUARD_TEACHING,
  stats: SWAP_GUARD_STATS,
  texts: { en, de, fa, ckb },
  testing: SWAP_GUARD_TESTING,
  persistence: SWAP_GUARD_PERSISTENCE,
};
