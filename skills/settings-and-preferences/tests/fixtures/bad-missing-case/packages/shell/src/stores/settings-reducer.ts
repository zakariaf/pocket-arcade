// packages/shell/src/stores/settings-reducer.ts
import type { SaveDoc, SaveSettings } from '@e07/shell/services/save/schema/save-doc.ts';

export type SettingsState = {
  readonly settings: SaveSettings;
  readonly firstRun: SaveDoc['firstRun'];
};

/** Every S11 row and the two first-run milestones. Imperative action names (naming-conventions). */
export type SettingsAction =
  | { readonly type: 'set-language'; readonly language: SaveSettings['language'] }
  | { readonly type: 'set-digits'; readonly digits: SaveSettings['digits'] }
  | { readonly type: 'set-sound'; readonly enabled: boolean; readonly volume: number }
  | { readonly type: 'set-music'; readonly enabled: boolean; readonly volume: number }
  | { readonly type: 'set-vibration'; readonly enabled: boolean }
  | { readonly type: 'set-theme'; readonly theme: SaveSettings['theme'] }
  | { readonly type: 'set-color-blind'; readonly enabled: boolean }
  | { readonly type: 'set-reduce-motion'; readonly reduceMotion: SaveSettings['reduceMotion'] }
  | { readonly type: 'set-hints-during-play'; readonly enabled: boolean }
  | { readonly type: 'finish-tutorial' };

const clampVolume = (volume: number): number => Math.min(100, Math.max(0, Math.round(volume)));

function withSettings(state: SettingsState, patch: Partial<SaveSettings>): SettingsState {
  return { ...state, settings: { ...state.settings, ...patch } };
}

/** Pure. Unit-tested per action; the store only persists and publishes the result. */
export function settingsReducer(state: SettingsState, action: SettingsAction): SettingsState {
  switch (action.type) {
    case 'set-language':
      return {
        settings: { ...state.settings, language: action.language },
        firstRun: { ...state.firstRun, languageChosen: true },
      };
    case 'set-digits':
      return withSettings(state, { digits: action.digits });
    case 'set-sound':
      return withSettings(state, {
        soundEnabled: action.enabled,
        soundVolume: clampVolume(action.volume),
      });
    case 'set-music':
      return withSettings(state, {
        musicEnabled: action.enabled,
        musicVolume: clampVolume(action.volume),
      });
    case 'set-theme':
      return withSettings(state, { theme: action.theme });
    case 'set-color-blind':
      return withSettings(state, { colorBlind: action.enabled });
    case 'set-reduce-motion':
      return withSettings(state, { reduceMotion: action.reduceMotion });
    case 'set-hints-during-play':
      return withSettings(state, { hintsDuringPlay: action.enabled });
    case 'finish-tutorial':
      return { ...state, firstRun: { ...state.firstRun, tutorialDone: true } };
  }
}
