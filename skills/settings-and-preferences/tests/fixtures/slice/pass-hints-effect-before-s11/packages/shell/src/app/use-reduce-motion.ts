// packages/shell/src/app/use-reduce-motion.ts
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

export function useReduceMotion(): boolean {
  const preference = useSettingsStore(selectReduceMotionPreference);
  const isSystemOn = useStore(systemA11yStore, (state) => state.isReduceMotionOn);
  return resolveReduceMotion(preference, isSystemOn);
}
