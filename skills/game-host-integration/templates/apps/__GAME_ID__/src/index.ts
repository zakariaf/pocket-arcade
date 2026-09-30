// apps/__GAME_ID__/src/index.ts
import { GAME_ART } from '@e07/__GAME_ID__/art/game-art.ts';
import { __GAME_CAMEL__Board } from '@e07/__GAME_ID__/board/__GAME_ID__-board.ts';
import ckb from '@e07/__GAME_ID__/i18n/ckb.json';
import de from '@e07/__GAME_ID__/i18n/de.json';
import en from '@e07/__GAME_ID__/i18n/en.json';
import fa from '@e07/__GAME_ID__/i18n/fa.json';
import { __GAME_CONST___LEVELS } from '@e07/__GAME_ID__/levels/__GAME_ID__-levels.ts';
import { __GAME_CONST___ENGINE, __GAME_CONST___RULES } from '@e07/__GAME_ID__/rules/__GAME_ID__-engine.ts';
import { __GAME_CONST___PERSISTENCE } from '@e07/__GAME_ID__/rules/__GAME_ID__-persistence.ts';
import { __GAME_CONST___STATS } from '@e07/__GAME_ID__/rules/__GAME_ID__-stats.ts';
import { SOUND_BANK } from '@e07/__GAME_ID__/sounds/sound-bank.ts';
import { __GAME_CONST___TESTING } from '@e07/__GAME_ID__/testing/__GAME_ID__-testing.ts';
import { PALETTE } from '@e07/__GAME_ID__/theme/palette.ts';
import { __GAME_CONST___TEACHING } from '@e07/__GAME_ID__/tutorial/__GAME_ID__-teaching.ts';

import type { __GAME_PASCAL__Types } from './__GAME_ID__-types.ts';
import type { ShellGameModule } from '@e07/shell/game-host/shell-game-module.ts';

/** The game as the Shell sees it (spec section 10). Assembly only; no logic here. */
export const __GAME_CAMEL__Game: ShellGameModule<__GAME_PASCAL__Types> = {
  identity: {
    id: '__GAME_ID__',
    nameId: '__GAME_ID__.name',
    winTitleId: '__GAME_ID__.win-title',
    taglineId: '__GAME_ID__.tagline',
  },
  engine: __GAME_CONST___ENGINE,
  rules: __GAME_CONST___RULES,
  levels: __GAME_CONST___LEVELS,
  presentation: {
    board: __GAME_CAMEL__Board,
    art: GAME_ART,
    sounds: SOUND_BANK,
    palette: PALETTE,
  },
  realtime: null,
  teaching: __GAME_CONST___TEACHING,
  stats: __GAME_CONST___STATS,
  texts: { en, de, fa, ckb },
  testing: __GAME_CONST___TESTING,
  persistence: __GAME_CONST___PERSISTENCE,
};
