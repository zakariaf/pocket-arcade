// packages/shell/src/game-host/use-hints-during-play.ts
// The "Hints during play" setting's effect: the game host shows teaching tips and hint nudges only
// while it is on (the Hint button itself always stays).
import { selectHintsDuringPlay } from '@e07/shell/stores/settings-selectors.ts';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

/** True while the player wants tips and nudges during play; re-renders when the setting flips. */
export function useHintsDuringPlay(): boolean {
  return useSettingsStore(selectHintsDuringPlay);
}
