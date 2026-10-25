// apps/merge-siege/src/index.ts
import { GAME_ART } from '@e07/merge-siege/art/game-art.ts';
import { mergeSiegeBoard } from '@e07/merge-siege/board/merge-siege-board.ts';
import ckb from '@e07/merge-siege/i18n/ckb.json';
import de from '@e07/merge-siege/i18n/de.json';
import en from '@e07/merge-siege/i18n/en.json';
import fa from '@e07/merge-siege/i18n/fa.json';
import { MERGE_SIEGE_LEVELS } from '@e07/merge-siege/levels/merge-siege-levels.ts';
import {
  MERGE_SIEGE_ENGINE,
  MERGE_SIEGE_RULES,
} from '@e07/merge-siege/rules/merge-siege-engine.ts';
import { MERGE_SIEGE_PERSISTENCE } from '@e07/merge-siege/rules/merge-siege-persistence.ts';
import { MERGE_SIEGE_STATS } from '@e07/merge-siege/rules/merge-siege-stats.ts';
import { SOUND_BANK } from '@e07/merge-siege/sounds/sound-bank.ts';
import { MERGE_SIEGE_TESTING } from '@e07/merge-siege/testing/merge-siege-testing.ts';
import { PALETTE } from '@e07/merge-siege/theme/palette.ts';
import { MERGE_SIEGE_TEACHING } from '@e07/merge-siege/tutorial/merge-siege-teaching.ts';

import type { MergeSiegeTypes } from './merge-siege-types.ts';
import type { ShellGameModule } from '@e07/shell/game-host/shell-game-module.ts';

/** The game as the Shell sees it (spec section 10). Assembly only; no logic here. */
export const mergeSiegeGame: ShellGameModule<MergeSiegeTypes> = {
  identity: {
    id: 'merge-siege',
    nameId: 'merge-siege.name',
    winTitleId: 'merge-siege.win-title',
    taglineId: 'merge-siege.tagline',
  },
  engine: MERGE_SIEGE_ENGINE,
  rules: MERGE_SIEGE_RULES,
  levels: MERGE_SIEGE_LEVELS,
  presentation: {
    board: mergeSiegeBoard,
    art: GAME_ART,
    sounds: SOUND_BANK,
    palette: PALETTE,
  },
  realtime: null,
  teaching: MERGE_SIEGE_TEACHING,
  stats: MERGE_SIEGE_STATS,
  texts: { en, de, fa, ckb },
  testing: MERGE_SIEGE_TESTING,
  persistence: MERGE_SIEGE_PERSISTENCE,
};
