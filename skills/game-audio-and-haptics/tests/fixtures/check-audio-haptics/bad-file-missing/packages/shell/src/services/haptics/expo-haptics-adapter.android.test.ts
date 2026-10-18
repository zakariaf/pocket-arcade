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
      Clock_Tick: 'clock-tick',
      Context_Click: 'context-click',
      Long_Press: 'long-press',
      Segment_Tick: 'segment-tick',
      Virtual_Key: 'virtual-key',
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

// The jest-expo Android preset reports no API level (Platform.Version is undefined), so each test
// names one: a current phone (Android 16, API 36) unless it says otherwise.
function onApiLevel(apiLevel: number): void {
  jest.spyOn(Platform, 'Version', 'get').mockReturnValue(apiLevel);
}

type Clock = { now: number };

function adapter(clock: Clock, isEnabled = true) {
  return createExpoHapticsAdapter({ isEnabled: () => isEnabled, nowMs: () => clock.now });
}

describe('createExpoHapticsAdapter on Android', () => {
  beforeEach(() => {
    native.calls.length = 0;
    native.unsupported.clear();
    onApiLevel(36);
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

// expo-haptics 57.0.3 reads each HapticFeedbackConstants field by reflection and rejects a type the
// phone lacks: Segment_Tick from API 34 (Android 14), Confirm and Reject from API 30 (Android 11).
// Clock_Tick, Context_Click, Keyboard_Tap, Long_Press and Virtual_Key have a fallback on every level.
const SINCE_API: Readonly<Record<string, number>> = {
  'segment-tick': 34,
  confirm: 30,
  reject: 30,
  'clock-tick': 1,
  'context-click': 1,
  'long-press': 1,
  'virtual-key': 1,
};

const ALL_CUES: readonly HapticCue[] = [
  'selection',
  'light',
  'medium',
  'heavy',
  'success',
  'warning',
  'error',
];

function playEveryCue(apiLevel: number): readonly string[] {
  onApiLevel(apiLevel);
  for (const [type, since] of Object.entries(SINCE_API)) {
    if (since > apiLevel) native.unsupported.add(type);
  }
  const clock = { now: 0 };
  const haptics = adapter(clock);
  for (const cue of ALL_CUES) {
    haptics.play(cue);
    clock.now += 100;
  }
  return [...native.calls];
}

describe('createExpoHapticsAdapter on older Android', () => {
  beforeEach(() => {
    native.calls.length = 0;
    native.unsupported.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('plays a Clock_Tick for selection below Android 14 (API 33)', () => {
    expect(playEveryCue(33)[0]).toBe('android:clock-tick');
  });

  it('plays only the types every level offers below Android 11 (API 29)', () => {
    expect(playEveryCue(29)).toStrictEqual([
      'android:clock-tick',
      'android:context-click',
      'android:virtual-key',
      'android:long-press',
      'android:virtual-key',
      'android:long-press',
      'android:long-press',
    ]);
  });

  it('keeps the newest types from Android 14 (API 34)', () => {
    expect(playEveryCue(34)).toStrictEqual([
      'android:segment-tick',
      'android:context-click',
      'android:confirm',
      'android:long-press',
      'android:confirm',
      'android:reject',
      'android:reject',
    ]);
  });

  it('gives every cue a type the phone offers on each level from API 24', () => {
    for (let apiLevel = 24; apiLevel <= 36; apiLevel += 1) {
      native.calls.length = 0;
      native.unsupported.clear();
      const types = playEveryCue(apiLevel).map((call) => call.slice('android:'.length));
      expect(types.filter((type) => (SINCE_API[type] ?? Infinity) > apiLevel)).toStrictEqual([]);
      expect(types).toHaveLength(ALL_CUES.length);
    }
  });
});
