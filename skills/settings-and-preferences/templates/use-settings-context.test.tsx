// packages/shell/src/screens/settings/use-settings-context.test.tsx
import { renderHook } from '@testing-library/react-native';

import { createFakeHaptics } from '@e07/shell/services/haptics/fake-haptics.ts';
import { createHostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';

import { useSettingsContext } from './use-settings-context.ts';

async function contextFor(hasMusic: boolean, canVibrate: boolean) {
  const shell = createHostWrapper({
    host: { hasMusic },
    services: { haptics: createFakeHaptics(canVibrate) },
  });
  const { result } = await renderHook(() => useSettingsContext(), { wrapper: shell.wrapper });
  return result.current;
}

describe('useSettingsContext', () => {
  it("takes the Music rows from the game host and Vibration from the phone's haptics", async () => {
    await expect(contextFor(true, false)).resolves.toStrictEqual({
      hasMusic: true,
      canVibrate: false,
      isPrivacyOptionsRequired: false,
      isPremium: false,
    });
    await expect(contextFor(false, true)).resolves.toMatchObject({
      hasMusic: false,
      canVibrate: true,
    });
  });
});
