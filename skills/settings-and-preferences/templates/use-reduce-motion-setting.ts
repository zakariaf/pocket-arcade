// packages/shell/src/app/use-reduce-motion-setting.ts
// The saved "Reduce motion" choice, resolved against the phone's switch. The Settings row shows and
// flips it; every animation reads useReduceMotion() instead (the same value, and also true during a
// parity capture). This file imports no test-only code, so code the test-only entry reaches (the
// S15 debug model) can read it without closing an import loop through app/test-only.ts.
import { useStore } from 'zustand';

import { selectReduceMotionPreference } from '@e07/shell/stores/settings-selectors.ts';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

import { systemA11yStore } from './system-a11y-store.ts';

import type { SaveSettings } from '@e07/shell/services/save/schema/save-doc.ts';

/** Settings row "Reduce motion" defaults to the phone's switch (spec S11). */
export function resolveReduceMotion(
  preference: SaveSettings['reduceMotion'],
  isSystemOn: boolean,
): boolean {
  if (preference === 'system') return isSystemOn;
  return preference === 'on';
}

/** The saved choice, or the phone's switch while it says System. Never frozen by a capture. */
export function useReduceMotionSetting(): boolean {
  const preference = useSettingsStore(selectReduceMotionPreference);
  const isSystemOn = useStore(systemA11yStore, (state) => state.isReduceMotionOn);
  return resolveReduceMotion(preference, isSystemOn);
}
