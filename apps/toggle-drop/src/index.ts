// apps/toggle-drop/src/index.ts
import { GAME_ART } from '@e07/toggle-drop/art/game-art.ts';
import { toggleDropBoard } from '@e07/toggle-drop/board/toggle-drop-board.ts';
import ckb from '@e07/toggle-drop/i18n/ckb.json';
import de from '@e07/toggle-drop/i18n/de.json';
import en from '@e07/toggle-drop/i18n/en.json';
import fa from '@e07/toggle-drop/i18n/fa.json';
import { TOGGLE_DROP_LEVELS } from '@e07/toggle-drop/levels/toggle-drop-levels.ts';
import {
  TOGGLE_DROP_ENGINE,
  TOGGLE_DROP_RULES,
} from '@e07/toggle-drop/rules/toggle-drop-engine.ts';
import { TOGGLE_DROP_PERSISTENCE } from '@e07/toggle-drop/rules/toggle-drop-persistence.ts';
import { TOGGLE_DROP_STATS } from '@e07/toggle-drop/rules/toggle-drop-stats.ts';
import { SOUND_BANK } from '@e07/toggle-drop/sounds/sound-bank.ts';
import { TOGGLE_DROP_TESTING } from '@e07/toggle-drop/testing/toggle-drop-testing.ts';
import { PALETTE } from '@e07/toggle-drop/theme/palette.ts';
import { TOGGLE_DROP_TEACHING } from '@e07/toggle-drop/tutorial/toggle-drop-teaching.ts';

import type { ToggleDropTypes } from './toggle-drop-types.ts';
import type { ShellGameModule } from '@e07/shell/game-host/shell-game-module.ts';

/** The game as the Shell sees it (spec section 10). Assembly only; no logic here. */
export const toggleDropGame: ShellGameModule<ToggleDropTypes> = {
  identity: {
    id: 'toggle-drop',
    nameId: 'toggle-drop.name',
    winTitleId: 'toggle-drop.win-title',
    taglineId: 'toggle-drop.tagline',
  },
  engine: TOGGLE_DROP_ENGINE,
  rules: TOGGLE_DROP_RULES,
  levels: TOGGLE_DROP_LEVELS,
  presentation: {
    board: toggleDropBoard,
    art: GAME_ART,
    sounds: SOUND_BANK,
    palette: PALETTE,
  },
  realtime: null,
  teaching: TOGGLE_DROP_TEACHING,
  stats: TOGGLE_DROP_STATS,
  texts: { en, de, fa, ckb },
  testing: TOGGLE_DROP_TESTING,
  persistence: TOGGLE_DROP_PERSISTENCE,
};
