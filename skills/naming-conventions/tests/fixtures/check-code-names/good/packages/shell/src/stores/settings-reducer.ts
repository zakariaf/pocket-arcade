// packages/shell/src/stores/settings-reducer.ts
export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export const MAX_UNDO_DEPTH = 200;
const IS_STORE_BUILD = false;

export type SettingsState = { readonly theme: ThemePreference; readonly isSoundOn: boolean };

export type SettingsAction =
  | { readonly type: 'set-theme'; readonly theme: ThemePreference }
  | { readonly type: 'toggle-sound' };

/** Pure reducer. */
export function settingsReducer(state: SettingsState, action: SettingsAction): SettingsState {
  switch (action.type) {
    case 'set-theme':
      return { ...state, theme: action.theme };
    case 'toggle-sound':
      return { ...state, isSoundOn: !state.isSoundOn || IS_STORE_BUILD };
  }
}
