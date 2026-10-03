// packages/shell/src/services/haptics/expo-haptics-adapter.ts
// The ONLY file that imports expo-haptics.
import {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  impactAsync,
  notificationAsync,
  selectionAsync,
} from 'expo-haptics';
import { Platform } from 'react-native';

import { shouldPulse } from './should-pulse.ts';

import type { HapticCue, HapticsPort } from './haptics-port.ts';

export type HapticsDeps = {
  /** Current value of the Vibration setting (read at call time). */
  readonly isEnabled: () => boolean;
  /** ClockPort.nowMs (epoch ms); never Date.now(). */
  readonly nowMs: () => number;
};

/** The haptic cue table, as code (one iOS call per cue). */
function fire(cue: HapticCue): Promise<void> {
  switch (cue) {
    case 'selection':
      return selectionAsync();
    case 'light':
      return impactAsync(ImpactFeedbackStyle.Light);
    case 'medium':
      return impactAsync(ImpactFeedbackStyle.Medium);
    case 'heavy':
      return impactAsync(ImpactFeedbackStyle.Heavy);
    case 'success':
      return notificationAsync(NotificationFeedbackType.Success);
    case 'warning':
      return notificationAsync(NotificationFeedbackType.Warning);
    case 'error':
      return notificationAsync(NotificationFeedbackType.Error);
  }
}

/** iPads have no Taptic Engine; phones do. Android (later) is treated as supported. */
function hasHaptics(): boolean {
  return Platform.OS === 'ios' ? !Platform.isPad : true;
}

export function createExpoHapticsAdapter(deps: HapticsDeps): HapticsPort {
  let lastAtMs: number | null = null;
  const isSupported = hasHaptics();
  return {
    isSupported,
    play: (cue) => {
      const nowMs = deps.nowMs();
      if (!isSupported || !shouldPulse({ isEnabled: deps.isEnabled(), lastAtMs, nowMs })) return;
      lastAtMs = nowMs;
      // Expo documents that haptics silently do nothing in Low Power Mode and similar states:
      // a failed pulse is the expected fallback, never an error for the player.
      fire(cue).catch(() => undefined);
    },
  };
}
