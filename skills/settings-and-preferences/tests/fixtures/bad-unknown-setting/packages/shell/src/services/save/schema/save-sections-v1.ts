// packages/shell/src/services/save/schema/save-sections-v1.ts (fixture excerpt)
import * as v from 'valibot';

import { PERCENT } from '@e07/shell/services/save/schema/save-primitives.ts';

export const SETTINGS_V1 = v.strictObject({
  /** null = "System". */
  language: v.nullable(v.picklist(['en', 'de', 'fa', 'ckb'])),
  digits: v.picklist(['automatic', 'latin', 'local']),
  soundEnabled: v.boolean(),
  soundVolume: PERCENT,
  musicEnabled: v.boolean(),
  musicVolume: PERCENT,
  vibrationEnabled: v.boolean(),
  theme: v.picklist(['system', 'light', 'dark']),
  colorBlind: v.boolean(),
  reduceMotion: v.picklist(['system', 'on', 'off']),
  hintsDuringPlay: v.boolean(),
  fontScale: v.number(),
});

export const FIRST_RUN_V1 = v.strictObject({
  languageChosen: v.boolean(),
  tutorialDone: v.boolean(),
});
