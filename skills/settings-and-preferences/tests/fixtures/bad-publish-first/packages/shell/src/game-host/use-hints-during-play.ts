// packages/shell/src/game-host/use-hints-during-play.ts (fixture)
import { selectHintsDuringPlay } from '@e07/shell/stores/settings-selectors.ts';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

export function useHintsDuringPlay(): boolean {
  return useSettingsStore(selectHintsDuringPlay);
}
