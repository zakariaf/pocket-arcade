// packages/shell/src/services/clock/system-clock-adapter.ts (planted: an adapter of another port asks Apple's ATT prompt)
import { getTrackingPermissionsAsync } from 'expo-tracking-transparency';

/** The device clock. */
export function createSystemClockAdapter(): { readonly nowMs: () => number } {
  void getTrackingPermissionsAsync();
  return { nowMs: () => Date.now() };
}
