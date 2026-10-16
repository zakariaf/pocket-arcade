// packages/shell/src/screens/settings/settings-rows.android.test.ts
// Runs in the unit-android Jest project (jest-expo/android): Platform.OS is 'android' here. The
// S11 Vibration row reads only HapticsPort.isSupported, never the platform: on Android the
// haptics adapter decides, so the row follows the real adapter's answer through the settings
// context the screen uses.
import { renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { createExpoHapticsAdapter } from '@e07/shell/services/haptics/expo-haptics-adapter.ts';
import { createFakeHaptics } from '@e07/shell/services/haptics/fake-haptics.ts';
import { createHostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';

import { settingsGroupsFor } from './settings-rows.ts';
import { useSettingsContext } from './use-settings-context.ts';

import type { SettingsRowId } from './settings-rows.ts';
import type { HapticsPort } from '@e07/shell/services/haptics/haptics-port.ts';

// A test build with test ads (TEST_EXPO_CONSTANTS: ADS_MODE=test, the game's ads on).
jest.mock(
  'expo-constants',
  () =>
    jest.requireActual<Record<string, unknown>>('@e07/shell/testing/test-game-extra.ts')[
      'TEST_EXPO_CONSTANTS'
    ],
);

/** The S11 Sound group's rows for a game without music, with these haptics as services.haptics. */
async function soundRowsWith(haptics: HapticsPort): Promise<readonly SettingsRowId[]> {
  const shell = createHostWrapper({ host: { hasMusic: false }, services: { haptics } });
  const { result } = await renderHook(() => useSettingsContext(), { wrapper: shell.wrapper });
  return settingsGroupsFor(result.current).find((group) => group.id === 'sound')?.rows ?? [];
}

// Spec S11: "Vibration: on/off, hidden on devices without vibration" (hidden, never greyed).
describe('the S11 Vibration row on Android', () => {
  it('runs on the Android platform', () => {
    expect(Platform.OS).toBe('android');
  });

  it('shows the row on an Android phone, whose haptics adapter reports support', async () => {
    const haptics = createExpoHapticsAdapter({ isEnabled: () => true, nowMs: () => 0 });
    await expect(soundRowsWith(haptics)).resolves.toStrictEqual([
      'sound-effects',
      'sound-volume',
      'vibration',
    ]);
  });

  it('hides the row when the haptics port reports no support', async () => {
    await expect(soundRowsWith(createFakeHaptics(false))).resolves.toStrictEqual([
      'sound-effects',
      'sound-volume',
    ]);
  });

  it('shows the row exactly when haptics.isSupported is true', async () => {
    const shown: boolean[] = [];
    for (const isSupported of [true, false]) {
      shown.push((await soundRowsWith(createFakeHaptics(isSupported))).includes('vibration'));
    }
    expect(shown).toStrictEqual([true, false]);
  });
});
