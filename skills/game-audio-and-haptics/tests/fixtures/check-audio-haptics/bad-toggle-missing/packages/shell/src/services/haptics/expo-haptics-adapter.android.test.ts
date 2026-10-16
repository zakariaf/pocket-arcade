// packages/shell/src/services/haptics/expo-haptics-adapter.android.test.ts
// Runs in the unit-android Jest project (jest-expo/android): Platform.OS is 'android' here.
import { Platform } from 'react-native';

import { createExpoHapticsAdapter } from './expo-haptics-adapter.ts';

import type { HapticCue } from './haptics-port.ts';

// Tests never import the vendor SDK: a factory mock records every native call instead.
jest.mock('expo-haptics', () => {
  const calls: string[] = [];
  const unsupported = new Set<string>();
  const record = (name: string) => (arg?: string) => {
    calls.push(arg === undefined ? name : `${name}:${arg}`);
    return Promise.resolve();
  };
  return {
    calls,
    unsupported,
    ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
    NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
    AndroidHaptics: {
      Confirm: 'confirm',
      Reject: 'reject',
      Context_Click: 'context-click',
      Long_Press: 'long-press',
      Segment_Tick: 'segment-tick',
    },
    impactAsync: record('impact'),
    notificationAsync: record('notification'),
    selectionAsync: record('selection'),
    performAndroidHapticsAsync: (type: string) => {
      calls.push(`android:${type}`);
      // expo-haptics rejects a type the phone's API level lacks (Segment_Tick before
      // Android 14, Confirm and Reject before Android 11).
      return unsupported.has(type) ? Promise.reject(new Error('unsupported')) : Promise.resolve();
    },
  };
});

const native = jest.requireMock<{ readonly calls: string[]; readonly unsupported: Set<string> }>(
  'expo-haptics',
);

type Clock = { now: number };

function adapter(clock: Clock, isEnabled = true) {
  return createExpoHapticsAdapter({ isEnabled: () => isEnabled, nowMs: () => clock.now });
}

describe('createExpoHapticsAdapter on Android', () => {
  beforeEach(() => {
    native.calls.length = 0;
    native.unsupported.clear();
  });

  it('runs on the Android platform', () => {
    expect(Platform.OS).toBe('android');
  });

  it('maps every cue to its Android haptic type, never to the Vibrator calls', () => {
    const clock = { now: 0 };
    const haptics = adapter(clock);
    const cues: readonly HapticCue[] = [
      'selection',
      'light',
      'medium',
      'heavy',
      'success',
      'warning',
      'error',
    ];
    for (const cue of cues) {
      haptics.play(cue);
      clock.now += 100;
    }
    expect(native.calls).toStrictEqual([
      'android:segment-tick',
      'android:context-click',
      'android:confirm',
      'android:long-press',
      'android:confirm',
      'android:reject',
      'android:reject',
    ]);
  });

  it('drops a pulse closer than 40 ms to the previous one', () => {
    const clock = { now: 1000 };
    const haptics = adapter(clock);
    haptics.play('medium');
    clock.now = 1039;
    haptics.play('medium');
    clock.now = 1040;
    haptics.play('heavy');
    expect(native.calls).toStrictEqual(['android:confirm', 'android:long-press']);
  });

  it('stays silent while the Vibration setting is off', () => {
    adapter({ now: 0 }, false).play('success');
    expect(native.calls).toStrictEqual([]);
  });

  it('swallows a type the phone does not offer (older Android) and keeps pulsing', async () => {
    native.unsupported.add('segment-tick');
    const clock = { now: 0 };
    const haptics = adapter(clock);
    haptics.play('selection');
    await Promise.resolve();
    clock.now = 100;
    haptics.play('success');
    expect(native.calls).toStrictEqual(['android:segment-tick', 'android:confirm']);
  });

  it('reports support on Android phones and tablets', () => {
    expect(adapter({ now: 0 }).isSupported).toBe(true);
  });
});
