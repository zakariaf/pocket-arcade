// packages/shell/src/screens/settings/use-display-settings.ts
import { useShallow } from 'zustand/shallow';

import { selectThemePreference } from '@e07/shell/stores/settings-selectors.ts';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

import type { SaveSettings } from '@e07/shell/services/save/schema/save-doc.ts';

export type DisplaySettings = {
  readonly theme: SaveSettings['theme'];
  readonly isColorBlind: boolean;
  readonly reduceMotion: SaveSettings['reduceMotion'];
};

/** The S11 DISPLAY rows: one primitive selector, one object selector through useShallow. */
export function useDisplaySettings(): DisplaySettings {
  const theme = useSettingsStore(selectThemePreference); // primitive: no useShallow needed
  const { isColorBlind, reduceMotion } = useSettingsStore(
    useShallow((state) => ({
      isColorBlind: state.settings.colorBlind,
      reduceMotion: state.settings.reduceMotion,
    })),
  );
  return { theme, isColorBlind, reduceMotion };
}
