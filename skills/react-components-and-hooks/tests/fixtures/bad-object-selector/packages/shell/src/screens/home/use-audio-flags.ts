import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

export function useAudioFlags(): { readonly isSound: boolean; readonly isMusic: boolean } {
  return useSettingsStore((state) => ({
    isSound: state.settings.soundEnabled,
    isMusic: state.settings.musicEnabled,
  }));
}
