import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

export function useThemeRow(): string {
  const state = useSettingsStore();
  return state.settings.theme;
}
