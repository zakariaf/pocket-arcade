// packages/shell/src/screens/settings/use-settings-context.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { ConsentMoment } from '@e07/shell/app/consent-moment.tsx';
import { createFakeAds } from '@e07/shell/services/ads/fake-ads.ts';
import { createFakeConnectivity } from '@e07/shell/services/connectivity/fake-connectivity.ts';
import { createFakeConsent } from '@e07/shell/services/consent/fake-consent.ts';
import { createFakeErrorLog } from '@e07/shell/services/error-log/fake-error-log.ts';
import { createFakeHaptics } from '@e07/shell/services/haptics/fake-haptics.ts';
import { createHostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';
import { TEST_CLOCK } from '@e07/shell/testing/create-test-save.ts';
import { flushMicrotasks } from '@e07/shell/testing/flush-microtasks.ts';

import { useSettingsContext } from './use-settings-context.ts';

import type { ReactNode } from 'react';

// A test build with test ads (TEST_EXPO_CONSTANTS: ADS_MODE=test, the game's ads on).
jest.mock(
  'expo-constants',
  () =>
    jest.requireActual<Record<string, unknown>>('@e07/shell/testing/test-game-extra.ts')[
      'TEST_EXPO_CONSTANTS'
    ],
);

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

  // Spec S11 and 8.8: "Ad privacy choices" shows only when Google says privacy options are
  // required. The answer can arrive while S11 is open (the launch refresh, the form, the options
  // themselves), and the row follows it at once, without leaving the screen.
  it("shows the Ad privacy row as soon as Google's answer requires it, on the open screen", async () => {
    const calls: string[] = [];
    const shell = createHostWrapper({
      services: {
        haptics: createFakeHaptics(true),
        errorLog: createFakeErrorLog(TEST_CLOCK),
        connectivity: createFakeConnectivity(true),
        consent: createFakeConsent({
          afterRefresh: { canRequestAds: false, isPrivacyOptionsRequired: true },
          afterForm: { canRequestAds: false, isPrivacyOptionsRequired: true },
          calls,
        }),
        ads: createFakeAds({
          rewardedStatus: 'unavailable',
          interstitialResult: 'unavailable',
          rewardResult: 'unavailable',
          calls,
        }),
      },
    });
    function WithMoment({ children }: { readonly children: ReactNode }): ReactNode {
      return (
        <shell.wrapper>
          <ConsentMoment isHeld={false} debug={null}>
            {children}
          </ConsentMoment>
        </shell.wrapper>
      );
    }
    const { result } = await renderHook(() => useSettingsContext(), { wrapper: WithMoment });
    await act(flushMicrotasks);

    expect([calls, result.current.isPrivacyOptionsRequired]).toStrictEqual([['refresh'], true]);
  });
});
