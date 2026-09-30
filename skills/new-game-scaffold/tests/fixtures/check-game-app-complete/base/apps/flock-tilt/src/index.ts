// apps/flock-tilt/src/index.ts (self-test fixture: the assembly shape the checker reads)
import ckb from '@e07/flock-tilt/i18n/ckb.json';
import de from '@e07/flock-tilt/i18n/de.json';
import en from '@e07/flock-tilt/i18n/en.json';
import fa from '@e07/flock-tilt/i18n/fa.json';

import type { FlockTiltTypes } from './flock-tilt-types.ts';
import type { ShellGameModule } from '@e07/shell/game-host/shell-game-module.ts';

export const flockTiltGame: ShellGameModule<FlockTiltTypes> = {
  identity: { id: 'flock-tilt', nameId: 'flock-tilt.name', winTitleId: 'flock-tilt.win-title', taglineId: 'flock-tilt.tagline' },
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
