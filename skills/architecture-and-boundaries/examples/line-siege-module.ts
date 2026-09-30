// apps/line-siege/src/index.ts
import { GAME_ART } from '@e07/line-siege/art/game-art.ts';
import { lineSiegeBoard } from '@e07/line-siege/board/line-siege-board.ts';
import ckb from '@e07/line-siege/i18n/ckb.json';
import de from '@e07/line-siege/i18n/de.json';
import en from '@e07/line-siege/i18n/en.json';
import fa from '@e07/line-siege/i18n/fa.json';
import { LINE_SIEGE_LEVELS } from '@e07/line-siege/levels/line-siege-levels.ts';
import { LINE_SIEGE_ENGINE, LINE_SIEGE_RULES } from '@e07/line-siege/rules/line-siege-engine.ts';
import { LINE_SIEGE_PERSISTENCE } from '@e07/line-siege/rules/line-siege-persistence.ts';
import { LINE_SIEGE_STATS } from '@e07/line-siege/rules/line-siege-stats.ts';
import { SOUND_BANK } from '@e07/line-siege/sounds/sound-bank.ts';
import { LINE_SIEGE_TESTING } from '@e07/line-siege/testing/line-siege-testing.ts';
import { PALETTE } from '@e07/line-siege/theme/palette.ts';
import { LINE_SIEGE_TEACHING } from '@e07/line-siege/tutorial/line-siege-teaching.ts';

import type { LineSiegeTypes } from './line-siege-types.ts';
import type { ShellGameModule } from '@e07/shell/game-host/shell-game-module.ts';

/** The game as the Shell sees it (spec section 10). Assembly only; no logic here. */
export const lineSiegeGame: ShellGameModule<LineSiegeTypes> = {
  identity: {
    id: 'line-siege',
    nameId: 'line-siege.name',
    winTitleId: 'line-siege.win-title',
    taglineId: 'line-siege.tagline',
  },
  engine: LINE_SIEGE_ENGINE,
  rules: LINE_SIEGE_RULES,
  levels: LINE_SIEGE_LEVELS,
  presentation: {
    board: lineSiegeBoard,
    art: GAME_ART,
    sounds: SOUND_BANK,
    palette: PALETTE,
  },
  realtime: null,
  teaching: LINE_SIEGE_TEACHING,
  stats: LINE_SIEGE_STATS,
  texts: { en, de, fa, ckb },
  testing: LINE_SIEGE_TESTING,
  persistence: LINE_SIEGE_PERSISTENCE,
};
