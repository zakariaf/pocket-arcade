// packages/shell/src/services/haptics/expo-haptics-adapter.ts
// The ONLY file that imports expo-haptics.
import {
  AndroidHaptics,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  impactAsync,
  notificationAsync,
  performAndroidHapticsAsync,
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

/** The haptic cue table's iOS column, as code (one iOS call per cue). */
function fireIos(cue: HapticCue): Promise<void> {
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

/**
 * The cue table's Android column: View haptic feedback (no Vibrator, no VIBRATE needed). expo-haptics
 * rejects a type the phone's API level lacks (Segment_Tick before API 34, Confirm and Reject before
 * API 30), so an older phone gets a type every level offers (Clock_Tick, Virtual_Key, Long_Press).
 */
function fireAndroid(cue: HapticCue): Promise<void> {
  const api = Number(Platform.Version);
  switch (cue) {
    case 'selection':
      return performAndroidHapticsAsync(
        api >= 34 ? AndroidHaptics.Segment_Tick : AndroidHaptics.Clock_Tick,
      );
    case 'light':
      return performAndroidHapticsAsync(AndroidHaptics.Context_Click);
    case 'medium':
      return performAndroidHapticsAsync(
        api >= 30 ? AndroidHaptics.Confirm : AndroidHaptics.Virtual_Key,
      );
    case 'heavy':
      return performAndroidHapticsAsync(AndroidHaptics.Long_Press);
    case 'success':
      return performAndroidHapticsAsync(
        api >= 30 ? AndroidHaptics.Confirm : AndroidHaptics.Virtual_Key,
      );
    case 'warning':
      return performAndroidHapticsAsync(
        api >= 30 ? AndroidHaptics.Reject : AndroidHaptics.Long_Press,
      );
    case 'error':
      return performAndroidHapticsAsync(
        api >= 30 ? AndroidHaptics.Reject : AndroidHaptics.Long_Press,
      );
  }
}

function fire(cue: HapticCue): Promise<void> {
  return Platform.OS === 'android' ? fireAndroid(cue) : fireIos(cue);
}

/** iPads have no Taptic Engine; phones do. Android phones and tablets are treated as supported. */
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
      void fire(cue);
    },
  };
}
