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
 * The cue table's Android column: View haptic feedback (no Vibrator, no VIBRATE needed). A type the
 * phone's API level lacks (Segment_Tick before Android 14, Confirm and Reject before Android 11)
 * rejects, and the caller's catch turns it into no pulse.
 */
function fireAndroid(cue: HapticCue): Promise<void> {
  switch (cue) {
    case 'selection':
      return performAndroidHapticsAsync(AndroidHaptics.Segment_Tick);
    case 'light':
      return performAndroidHapticsAsync(AndroidHaptics.Context_Click);
    case 'medium':
      return performAndroidHapticsAsync(AndroidHaptics.Confirm);
    case 'heavy':
      return performAndroidHapticsAsync(AndroidHaptics.Long_Press);
    case 'success':
      return performAndroidHapticsAsync(AndroidHaptics.Confirm);
    case 'warning':
      return performAndroidHapticsAsync(AndroidHaptics.Reject);
    case 'error':
      return performAndroidHapticsAsync(AndroidHaptics.Reject);
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
      fire(cue).catch(() => undefined);
    },
  };
}
