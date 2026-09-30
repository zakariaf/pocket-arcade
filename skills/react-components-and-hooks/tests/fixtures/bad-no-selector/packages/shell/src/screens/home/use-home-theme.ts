import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

export function useHomeTheme(): string {
  return useSettingsStore().settings.theme;
}
