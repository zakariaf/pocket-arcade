// packages/shell/src/navigation/route-guards.ts
import { TEST_ONLY } from '@e07/shell/app/test-only.ts';
import { selectIsRestartPending, useRestartStore } from '@e07/shell/stores/restart-store.ts';
import {
  selectIsFirstRun,
  selectNeedsLanguageChoice,
} from '@e07/shell/stores/settings-selectors.ts';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

// Static-config `if` hooks: evaluated on every render of the navigator.
// A group or screen whose hook returns false is not registered at all, so flows switch
// by changing store state (dispatch), never by calling navigate().

/** FirstRun group: until the tutorial level is finished. */
export function useIsFirstRun(): boolean {
  return useSettingsStore(selectIsFirstRun);
}

/** Main group: after the tutorial level. Home is its first screen, so it becomes the root. */
export function useIsMainApp(): boolean {
  return !useSettingsStore(selectIsFirstRun);
}

/**
 * S2 until a language is chosen, and while the direction restart that choice started is pending
 * (the tutorial never mounts in the old direction); a relaunch after the reload opens Tutorial.
 */
export function useNeedsLanguageChoice(): boolean {
  const isChoiceNeeded = useSettingsStore(selectNeedsLanguageChoice);
  const isRestartPending = useRestartStore(selectIsRestartPending);
  return isChoiceNeeded || isRestartPending;
}

/** Debug group (S15): test builds only. TEST_ONLY drives behaviour, never code inclusion. */
export function useIsTestBuild(): boolean {
  return TEST_ONLY !== null;
}
