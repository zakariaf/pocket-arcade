// apps/flock-tilt/src/index.ts
import { GAME_ART } from '@e07/flock-tilt/art/game-art.ts';
import { flockTiltBoard } from '@e07/flock-tilt/board/flock-tilt-board.ts';
import ckb from '@e07/flock-tilt/i18n/ckb.json';
import de from '@e07/flock-tilt/i18n/de.json';
import en from '@e07/flock-tilt/i18n/en.json';
import fa from '@e07/flock-tilt/i18n/fa.json';
import { FLOCK_TILT_LEVELS } from '@e07/flock-tilt/levels/flock-tilt-levels.ts';
import { FLOCK_TILT_ENGINE, FLOCK_TILT_RULES } from '@e07/flock-tilt/rules/flock-tilt-engine.ts';
import { FLOCK_TILT_PERSISTENCE } from '@e07/flock-tilt/rules/flock-tilt-persistence.ts';
import { FLOCK_TILT_STATS } from '@e07/flock-tilt/rules/flock-tilt-stats.ts';
import { SOUND_BANK } from '@e07/flock-tilt/sounds/sound-bank.ts';
import { FLOCK_TILT_TESTING } from '@e07/flock-tilt/testing/flock-tilt-testing.ts';
import { PALETTE } from '@e07/flock-tilt/theme/palette.ts';
import { FLOCK_TILT_TEACHING } from '@e07/flock-tilt/tutorial/flock-tilt-teaching.ts';

import type { FlockTiltTypes } from './flock-tilt-types.ts';
import type { ShellGameModule } from '@e07/shell/game-host/shell-game-module.ts';

/** The game as the Shell sees it (spec section 10). Assembly only; no logic here. */
export const flockTiltGame: ShellGameModule<FlockTiltTypes> = {
  identity: {
    id: 'flock-tilt',
    nameId: 'flock-tilt.name',
    winTitleId: 'flock-tilt.win-title',
    taglineId: 'flock-tilt.tagline',
  },
  engine: FLOCK_TILT_ENGINE,
  rules: FLOCK_TILT_RULES,
  levels: FLOCK_TILT_LEVELS,
  presentation: {
    board: flockTiltBoard,
    art: GAME_ART,
    sounds: SOUND_BANK,
    palette: PALETTE,
  },
  realtime: null,
  teaching: FLOCK_TILT_TEACHING,
  stats: FLOCK_TILT_STATS,
  texts: { en, de, fa, ckb },
  testing: FLOCK_TILT_TESTING,
  persistence: FLOCK_TILT_PERSISTENCE,
};
