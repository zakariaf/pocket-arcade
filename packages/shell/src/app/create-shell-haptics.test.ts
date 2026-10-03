// packages/shell/src/app/create-shell-haptics.test.ts
import { createShellStores } from '@e07/shell/stores/create-shell-stores.ts';
import { TEST_CLOCK, createTestSave } from '@e07/shell/testing/create-test-save.ts';

import { createShellHaptics } from './create-shell-haptics.ts';

import type { ClockPort } from '@e07/shell/services/clock/clock-port.ts';

// Tests never import the vendor SDK: a factory mock records every native call instead.
jest.mock('expo-haptics', () => {
  const calls: string[] = [];
  const record = (name: string) => () => {
    calls.push(name);
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

describe('createShellHaptics', () => {
  beforeEach(() => {
    native.calls.length = 0;
  });

  it('pulses while Vibration is on and stops at the next pulse once it is off', () => {
    const { save } = createTestSave();
    const stores = createShellStores(save);
    let now = 1_000;
    // Pulses 1 s apart, far beyond the 40 ms throttle: only the setting can stop the second one.
    const clock: ClockPort = { ...TEST_CLOCK, nowMs: () => now };
    const haptics = createShellHaptics(stores.settings, clock);

    haptics.play('selection');
    stores.settings.getState().dispatch({ type: 'set-vibration', enabled: false });
    now += 1_000;
    haptics.play('selection');

    expect(native.calls).toStrictEqual(['selection']);
  });
});
