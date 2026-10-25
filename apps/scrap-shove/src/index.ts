// apps/scrap-shove/src/index.ts
import { GAME_ART } from '@e07/scrap-shove/art/game-art.ts';
import { scrapShoveBoard } from '@e07/scrap-shove/board/scrap-shove-board.ts';
import ckb from '@e07/scrap-shove/i18n/ckb.json';
import de from '@e07/scrap-shove/i18n/de.json';
import en from '@e07/scrap-shove/i18n/en.json';
import fa from '@e07/scrap-shove/i18n/fa.json';
import { SCRAP_SHOVE_LEVELS } from '@e07/scrap-shove/levels/scrap-shove-levels.ts';
import {
  SCRAP_SHOVE_ENGINE,
  SCRAP_SHOVE_RULES,
} from '@e07/scrap-shove/rules/scrap-shove-engine.ts';
import { SCRAP_SHOVE_PERSISTENCE } from '@e07/scrap-shove/rules/scrap-shove-persistence.ts';
import { SCRAP_SHOVE_STATS } from '@e07/scrap-shove/rules/scrap-shove-stats.ts';
import { SOUND_BANK } from '@e07/scrap-shove/sounds/sound-bank.ts';
import { SCRAP_SHOVE_TESTING } from '@e07/scrap-shove/testing/scrap-shove-testing.ts';
import { PALETTE } from '@e07/scrap-shove/theme/palette.ts';
import { SCRAP_SHOVE_TEACHING } from '@e07/scrap-shove/tutorial/scrap-shove-teaching.ts';

import type { ScrapShoveTypes } from './scrap-shove-types.ts';
import type { ShellGameModule } from '@e07/shell/game-host/shell-game-module.ts';

/** The game as the Shell sees it (spec section 10). Assembly only; no logic here. */
export const scrapShoveGame: ShellGameModule<ScrapShoveTypes> = {
  identity: {
    id: 'scrap-shove',
    nameId: 'scrap-shove.name',
    winTitleId: 'scrap-shove.win-title',
    taglineId: 'scrap-shove.tagline',
  },
  engine: SCRAP_SHOVE_ENGINE,
  rules: SCRAP_SHOVE_RULES,
  levels: SCRAP_SHOVE_LEVELS,
  presentation: {
    board: scrapShoveBoard,
    art: GAME_ART,
    sounds: SOUND_BANK,
    palette: PALETTE,
  },
  realtime: null,
  teaching: SCRAP_SHOVE_TEACHING,
  stats: SCRAP_SHOVE_STATS,
  texts: { en, de, fa, ckb },
  testing: SCRAP_SHOVE_TESTING,
  persistence: SCRAP_SHOVE_PERSISTENCE,
};
