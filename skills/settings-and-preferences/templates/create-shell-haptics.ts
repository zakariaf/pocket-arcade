// packages/shell/src/app/create-shell-haptics.ts
// The Vibration setting's effect: the haptics adapter asks the settings store at every pulse, so
// switching Vibration off stops the very next pulse (no restart, no subscription to forget).
import { createExpoHapticsAdapter } from '@e07/shell/services/haptics/expo-haptics-adapter.ts';
import { selectIsVibrationOn } from '@e07/shell/stores/settings-selectors.ts';

import type { ClockPort } from '@e07/shell/services/clock/clock-port.ts';
import type { HapticsPort } from '@e07/shell/services/haptics/haptics-port.ts';
import type { SettingsStore } from '@e07/shell/stores/settings-store.ts';

/**
 * Built once in the composition root; the result is services.haptics. Only getState() is read,
 * and only at pulse time, so the composition root may create the haptics before the stores
 * (the game host needs them first): createShellHaptics({ getState: () => stores.settings.getState() }, clock).
 */
export function createShellHaptics(
  settings: Pick<SettingsStore, 'getState'>,
  clock: Pick<ClockPort, 'nowMs'>,
): HapticsPort {
  return createExpoHapticsAdapter({
    isEnabled: () => selectIsVibrationOn(settings.getState()),
    nowMs: clock.nowMs,
  });
}
