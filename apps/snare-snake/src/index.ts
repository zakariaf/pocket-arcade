// apps/snare-snake/src/index.ts
import { GAME_ART } from '@e07/snare-snake/art/game-art.ts';
import { snareSnakeBoard } from '@e07/snare-snake/board/snare-snake-board.ts';
import ckb from '@e07/snare-snake/i18n/ckb.json';
import de from '@e07/snare-snake/i18n/de.json';
import en from '@e07/snare-snake/i18n/en.json';
import fa from '@e07/snare-snake/i18n/fa.json';
import { SNARE_SNAKE_LEVELS } from '@e07/snare-snake/levels/snare-snake-levels.ts';
import {
  SNARE_SNAKE_ENGINE,
  SNARE_SNAKE_RULES,
} from '@e07/snare-snake/rules/snare-snake-engine.ts';
import { SNARE_SNAKE_PERSISTENCE } from '@e07/snare-snake/rules/snare-snake-persistence.ts';
import { SNARE_SNAKE_STATS } from '@e07/snare-snake/rules/snare-snake-stats.ts';
import { SOUND_BANK } from '@e07/snare-snake/sounds/sound-bank.ts';
import { SNARE_SNAKE_TESTING } from '@e07/snare-snake/testing/snare-snake-testing.ts';
import { PALETTE } from '@e07/snare-snake/theme/palette.ts';
import { SNARE_SNAKE_TEACHING } from '@e07/snare-snake/tutorial/snare-snake-teaching.ts';

import type { SnareSnakeTypes } from './snare-snake-types.ts';
import type { ShellGameModule } from '@e07/shell/game-host/shell-game-module.ts';

/** The game as the Shell sees it (spec section 10). Assembly only; no logic here. */
export const snareSnakeGame: ShellGameModule<SnareSnakeTypes> = {
  identity: {
    id: 'snare-snake',
    nameId: 'snare-snake.name',
    winTitleId: 'snare-snake.win-title',
    taglineId: 'snare-snake.tagline',
  },
  engine: SNARE_SNAKE_ENGINE,
  rules: SNARE_SNAKE_RULES,
  levels: SNARE_SNAKE_LEVELS,
  presentation: {
    board: snareSnakeBoard,
    art: GAME_ART,
    sounds: SOUND_BANK,
    palette: PALETTE,
  },
  realtime: null,
  teaching: SNARE_SNAKE_TEACHING,
  stats: SNARE_SNAKE_STATS,
  texts: { en, de, fa, ckb },
  testing: SNARE_SNAKE_TESTING,
  persistence: SNARE_SNAKE_PERSISTENCE,
};
