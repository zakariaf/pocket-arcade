// apps/poker-drop/src/index.ts
import { GAME_ART } from '@e07/poker-drop/art/game-art.ts';
import { pokerDropBoard } from '@e07/poker-drop/board/poker-drop-board.ts';
import ckb from '@e07/poker-drop/i18n/ckb.json';
import de from '@e07/poker-drop/i18n/de.json';
import en from '@e07/poker-drop/i18n/en.json';
import fa from '@e07/poker-drop/i18n/fa.json';
import { POKER_DROP_LEVELS } from '@e07/poker-drop/levels/poker-drop-levels.ts';
import { POKER_DROP_ENGINE, POKER_DROP_RULES } from '@e07/poker-drop/rules/poker-drop-engine.ts';
import { POKER_DROP_PERSISTENCE } from '@e07/poker-drop/rules/poker-drop-persistence.ts';
import { POKER_DROP_STATS } from '@e07/poker-drop/rules/poker-drop-stats.ts';
import { SOUND_BANK } from '@e07/poker-drop/sounds/sound-bank.ts';
import { POKER_DROP_TESTING } from '@e07/poker-drop/testing/poker-drop-testing.ts';
import { PALETTE } from '@e07/poker-drop/theme/palette.ts';
import { POKER_DROP_TEACHING } from '@e07/poker-drop/tutorial/poker-drop-teaching.ts';

import type { PokerDropTypes } from './poker-drop-types.ts';
import type { ShellGameModule } from '@e07/shell/game-host/shell-game-module.ts';

/** The game as the Shell sees it (spec section 10). Assembly only; no logic here. */
export const pokerDropGame: ShellGameModule<PokerDropTypes> = {
  identity: {
    id: 'poker-drop',
    nameId: 'poker-drop.name',
    winTitleId: 'poker-drop.win-title',
    taglineId: 'poker-drop.tagline',
  },
  engine: POKER_DROP_ENGINE,
  rules: POKER_DROP_RULES,
  levels: POKER_DROP_LEVELS,
  presentation: {
    board: pokerDropBoard,
    art: GAME_ART,
    sounds: SOUND_BANK,
    palette: PALETTE,
  },
  realtime: null,
  teaching: POKER_DROP_TEACHING,
  stats: POKER_DROP_STATS,
  texts: { en, de, fa, ckb },
  testing: POKER_DROP_TESTING,
  persistence: POKER_DROP_PERSISTENCE,
};
