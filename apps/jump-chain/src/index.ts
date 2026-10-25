// apps/jump-chain/src/index.ts
import { GAME_ART } from '@e07/jump-chain/art/game-art.ts';
import { jumpChainBoard } from '@e07/jump-chain/board/jump-chain-board.ts';
import ckb from '@e07/jump-chain/i18n/ckb.json';
import de from '@e07/jump-chain/i18n/de.json';
import en from '@e07/jump-chain/i18n/en.json';
import fa from '@e07/jump-chain/i18n/fa.json';
import { JUMP_CHAIN_LEVELS } from '@e07/jump-chain/levels/jump-chain-levels.ts';
import { JUMP_CHAIN_ENGINE, JUMP_CHAIN_RULES } from '@e07/jump-chain/rules/jump-chain-engine.ts';
import { JUMP_CHAIN_PERSISTENCE } from '@e07/jump-chain/rules/jump-chain-persistence.ts';
import { JUMP_CHAIN_STATS } from '@e07/jump-chain/rules/jump-chain-stats.ts';
import { SOUND_BANK } from '@e07/jump-chain/sounds/sound-bank.ts';
import { JUMP_CHAIN_TESTING } from '@e07/jump-chain/testing/jump-chain-testing.ts';
import { PALETTE } from '@e07/jump-chain/theme/palette.ts';
import { JUMP_CHAIN_TEACHING } from '@e07/jump-chain/tutorial/jump-chain-teaching.ts';

import type { JumpChainTypes } from './jump-chain-types.ts';
import type { ShellGameModule } from '@e07/shell/game-host/shell-game-module.ts';

/** The game as the Shell sees it (spec section 10). Assembly only; no logic here. */
export const jumpChainGame: ShellGameModule<JumpChainTypes> = {
  identity: {
    id: 'jump-chain',
    nameId: 'jump-chain.name',
    winTitleId: 'jump-chain.win-title',
    taglineId: 'jump-chain.tagline',
  },
  engine: JUMP_CHAIN_ENGINE,
  rules: JUMP_CHAIN_RULES,
  levels: JUMP_CHAIN_LEVELS,
  presentation: {
    board: jumpChainBoard,
    art: GAME_ART,
    sounds: SOUND_BANK,
    palette: PALETTE,
  },
  realtime: null,
  teaching: JUMP_CHAIN_TEACHING,
  stats: JUMP_CHAIN_STATS,
  texts: { en, de, fa, ckb },
  testing: JUMP_CHAIN_TESTING,
  persistence: JUMP_CHAIN_PERSISTENCE,
};
