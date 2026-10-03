// packages/shell/src/i18n/direction.ts
// The ONLY module allowed to read I18nManager.isRTL (ESLint exemption in eslint.config.mjs).
import { reloadAppAsync } from 'expo';
import { I18nManager } from 'react-native';

import type { DirectionGuard } from './direction-guard.ts';
import type { Direction } from './languages.ts';

// Constant for the whole JS run: React Native computes it once when the module loads.
export function readLayoutDirection(): Direction {
  return I18nManager.isRTL ? 'rtl' : 'ltr';
}

// allowRTL AND forceRTL, always: allowRTL(false) keeps English LTR on a Persian phone.
export function forceLayoutDirection(direction: Direction): void {
  const isRtl = direction === 'rtl';
  I18nManager.allowRTL(isRtl);
  I18nManager.forceRTL(isRtl);
}

// Call only after the save is written (sync SQLite writes are complete on return), and only
// from a mounted component (a button handler or the startup splash's effect).
export async function restartForDirection(
  direction: Direction,
  guard: DirectionGuard,
): Promise<void> {
  guard.writePending(direction);
  forceLayoutDirection(direction);
  await reloadAppAsync(`layout direction -> ${direction}`);
}
