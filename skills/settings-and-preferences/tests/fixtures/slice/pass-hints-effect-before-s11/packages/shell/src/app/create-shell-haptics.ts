// packages/shell/src/app/create-shell-haptics.ts (fixture)
import { createExpoHapticsAdapter } from '@e07/shell/services/haptics/expo-haptics-adapter.ts';
import { selectIsVibrationOn } from '@e07/shell/stores/settings-selectors.ts';

import type { ClockPort } from '@e07/shell/services/clock/clock-port.ts';
import type { HapticsPort } from '@e07/shell/services/haptics/haptics-port.ts';
import type { SettingsStore } from '@e07/shell/stores/settings-store.ts';

export function createShellHaptics(settings: SettingsStore, clock: ClockPort): HapticsPort {
  return createExpoHapticsAdapter({
    isEnabled: () => selectIsVibrationOn(settings.getState()),
    nowMs: clock.nowMs,
  });
}
