// packages/shell/src/services/haptics/expo-haptics-adapter.test.ts
import { Platform } from 'react-native';

import { createExpoHapticsAdapter } from './expo-haptics-adapter.ts';

import type { HapticCue } from './haptics-port.ts';

// Tests never import the vendor SDK: a factory mock records every native call instead.
jest.mock('expo-haptics', () => {
  const calls: string[] = [];
  const record = (name: string) => (arg?: string) => {
    calls.push(arg === undefined ? name : `${name}:${arg}`);
    return Promise.resolve();
  };
  return {
    calls,
    ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
    NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
    impactAsync: record('impact'),
    notificationAsync: record('notification'),
    selectionAsync: record('selection'),
  };
});

const native = jest.requireMock<{ readonly calls: string[] }>('expo-haptics');

type Clock = { now: number };

function adapter(clock: Clock, isEnabled = true) {
  return createExpoHapticsAdapter({ isEnabled: () => isEnabled, nowMs: () => clock.now });
}

describe('createExpoHapticsAdapter', () => {
  beforeEach(() => {
    native.calls.length = 0;
  });

  it('maps every cue to its iOS call', () => {
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
      'selection',
      'impact:light',
      'impact:medium',
      'impact:heavy',
      'notification:success',
      'notification:warning',
      'notification:error',
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
    expect(native.calls).toStrictEqual(['impact:medium', 'impact:heavy']);
  });

  it('stays silent while the Vibration setting is off', () => {
    adapter({ now: 0 }, false).play('success');
    expect(native.calls).toStrictEqual([]);
  });

  it('reports support on an iPhone and none on an iPad', () => {
    const isPad = Platform.OS === 'ios' && Platform.isPad;
    expect(adapter({ now: 0 }).isSupported).toBe(!isPad);
  });
});
