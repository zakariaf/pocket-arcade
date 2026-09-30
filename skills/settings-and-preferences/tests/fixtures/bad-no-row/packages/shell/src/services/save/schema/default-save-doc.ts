// packages/shell/src/services/save/schema/default-save-doc.ts
import { LATEST_SAVE_VERSION } from '@e07/shell/services/save/schema/save-doc.ts';

import type { SaveDoc, SaveSettings } from '@e07/shell/services/save/schema/save-doc.ts';

/** First-launch settings. Music is OFF by default (never over the player's music, 8.7). */
export const DEFAULT_SETTINGS: SaveSettings = {
  language: null,
  digits: 'automatic',
  soundEnabled: true,
  soundVolume: 80,
  musicEnabled: false,
  musicVolume: 60,
  vibrationEnabled: true,
  theme: 'system',
  colorBlind: false,
  reduceMotion: 'system',
  hintsDuringPlay: true,
};
