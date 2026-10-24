// apps/stepstone/src/index.ts
import { GAME_ART } from '@e07/stepstone/art/game-art.ts';
import { stepstoneBoard } from '@e07/stepstone/board/stepstone-board.ts';
import ckb from '@e07/stepstone/i18n/ckb.json';
import de from '@e07/stepstone/i18n/de.json';
import en from '@e07/stepstone/i18n/en.json';
import fa from '@e07/stepstone/i18n/fa.json';
import { STEPSTONE_LEVELS } from '@e07/stepstone/levels/stepstone-levels.ts';
import { STEPSTONE_ENGINE, STEPSTONE_RULES } from '@e07/stepstone/rules/stepstone-engine.ts';
import { STEPSTONE_PERSISTENCE } from '@e07/stepstone/rules/stepstone-persistence.ts';
import { STEPSTONE_STATS } from '@e07/stepstone/rules/stepstone-stats.ts';
import { SOUND_BANK } from '@e07/stepstone/sounds/sound-bank.ts';
import { STEPSTONE_TESTING } from '@e07/stepstone/testing/stepstone-testing.ts';
import { PALETTE } from '@e07/stepstone/theme/palette.ts';
import { STEPSTONE_TEACHING } from '@e07/stepstone/tutorial/stepstone-teaching.ts';

import type { StepstoneTypes } from './stepstone-types.ts';
import type { ShellGameModule } from '@e07/shell/game-host/shell-game-module.ts';

/** The game as the Shell sees it (spec section 10). Assembly only; no logic here. */
export const stepstoneGame: ShellGameModule<StepstoneTypes> = {
  identity: {
    id: 'stepstone',
    nameId: 'stepstone.name',
    winTitleId: 'stepstone.win-title',
    taglineId: 'stepstone.tagline',
  },
  engine: STEPSTONE_ENGINE,
  rules: STEPSTONE_RULES,
  levels: STEPSTONE_LEVELS,
  presentation: {
    board: stepstoneBoard,
    art: GAME_ART,
    sounds: SOUND_BANK,
    palette: PALETTE,
  },
  realtime: null,
  teaching: STEPSTONE_TEACHING,
  stats: STEPSTONE_STATS,
  texts: { en, de, fa, ckb },
  testing: STEPSTONE_TESTING,
  persistence: STEPSTONE_PERSISTENCE,
};
