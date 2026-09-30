// packages/shell/src/stores/settings-reducer.ts
// Naming illustration (the real settings reducer has more fields; state-stores owns it): the
// as-const table and its derived union, <Domain>State, <Domain>Action with kebab-case imperative
// `type` values, DEFAULT_<DOMAIN> and <domain>Reducer.
export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export type SettingsState = {
  readonly theme: ThemePreference;
  readonly isSoundOn: boolean;
};

export type SettingsAction =
  | { readonly type: 'set-theme'; readonly theme: ThemePreference }
  | { readonly type: 'toggle-sound' };

export const DEFAULT_SETTINGS: SettingsState = { theme: 'system', isSoundOn: true };

/** Pure reducer: every settings change goes through here (spec S11). */
export function settingsReducer(state: SettingsState, action: SettingsAction): SettingsState {
  switch (action.type) {
    case 'set-theme':
      return { ...state, theme: action.theme };
    case 'toggle-sound':
      return { ...state, isSoundOn: !state.isSoundOn };
  }
}
