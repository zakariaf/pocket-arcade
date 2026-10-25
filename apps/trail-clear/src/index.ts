// apps/trail-clear/src/index.ts
import { GAME_ART } from '@e07/trail-clear/art/game-art.ts';
import { trailClearBoard } from '@e07/trail-clear/board/trail-clear-board.ts';
import ckb from '@e07/trail-clear/i18n/ckb.json';
import de from '@e07/trail-clear/i18n/de.json';
import en from '@e07/trail-clear/i18n/en.json';
import fa from '@e07/trail-clear/i18n/fa.json';
import { TRAIL_CLEAR_LEVELS } from '@e07/trail-clear/levels/trail-clear-levels.ts';
import {
  TRAIL_CLEAR_ENGINE,
  TRAIL_CLEAR_RULES,
} from '@e07/trail-clear/rules/trail-clear-engine.ts';
import { TRAIL_CLEAR_PERSISTENCE } from '@e07/trail-clear/rules/trail-clear-persistence.ts';
import { TRAIL_CLEAR_STATS } from '@e07/trail-clear/rules/trail-clear-stats.ts';
import { SOUND_BANK } from '@e07/trail-clear/sounds/sound-bank.ts';
import { TRAIL_CLEAR_TESTING } from '@e07/trail-clear/testing/trail-clear-testing.ts';
import { PALETTE } from '@e07/trail-clear/theme/palette.ts';
import { TRAIL_CLEAR_TEACHING } from '@e07/trail-clear/tutorial/trail-clear-teaching.ts';

import type { TrailClearTypes } from './trail-clear-types.ts';
import type { ShellGameModule } from '@e07/shell/game-host/shell-game-module.ts';

/** The game as the Shell sees it (spec section 10). Assembly only; no logic here. */
export const trailClearGame: ShellGameModule<TrailClearTypes> = {
  identity: {
    id: 'trail-clear',
    nameId: 'trail-clear.name',
    winTitleId: 'trail-clear.win-title',
    taglineId: 'trail-clear.tagline',
  },
  engine: TRAIL_CLEAR_ENGINE,
  rules: TRAIL_CLEAR_RULES,
  levels: TRAIL_CLEAR_LEVELS,
  presentation: {
    board: trailClearBoard,
    art: GAME_ART,
    sounds: SOUND_BANK,
    palette: PALETTE,
  },
  realtime: null,
  teaching: TRAIL_CLEAR_TEACHING,
  stats: TRAIL_CLEAR_STATS,
  texts: { en, de, fa, ckb },
  testing: TRAIL_CLEAR_TESTING,
  persistence: TRAIL_CLEAR_PERSISTENCE,
};
