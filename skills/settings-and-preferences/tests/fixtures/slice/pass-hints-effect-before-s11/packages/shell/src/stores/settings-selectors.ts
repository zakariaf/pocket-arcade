// packages/shell/src/stores/settings-selectors.ts
import type { SettingsStoreState } from '@e07/shell/stores/settings-store.ts';

type Settings = SettingsStoreState['settings'];

// Selectors return primitives or references that already live in the state.
// Anything that builds a new object or array goes through useShallow at the call site.
// `…Preference` names avoid a clash with the theme module's selectTheme(themes, selector).
export const selectSettings = (state: SettingsStoreState): Settings => state.settings;
export const selectLanguage = (state: SettingsStoreState): Settings['language'] =>
  state.settings.language;
export const selectDigits = (state: SettingsStoreState): Settings['digits'] =>
  state.settings.digits;
export const selectThemePreference = (state: SettingsStoreState): Settings['theme'] =>
  state.settings.theme;
export const selectIsColorBlind = (state: SettingsStoreState): boolean => state.settings.colorBlind;
export const selectReduceMotionPreference = (state: SettingsStoreState): Settings['reduceMotion'] =>
  state.settings.reduceMotion;
export const selectIsVibrationOn = (state: SettingsStoreState): boolean =>
  state.settings.vibrationEnabled;
export const selectHintsDuringPlay = (state: SettingsStoreState): boolean =>
  state.settings.hintsDuringPlay;
export const selectIsFirstRun = (state: SettingsStoreState): boolean =>
  !state.firstRun.tutorialDone;
export const selectNeedsLanguageChoice = (state: SettingsStoreState): boolean =>
  !state.firstRun.languageChosen;
export const selectDispatch = (state: SettingsStoreState): SettingsStoreState['dispatch'] =>
  state.dispatch;
