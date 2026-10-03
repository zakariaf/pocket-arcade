// packages/shell/src/app/consent-moment.test.tsx
import { act, screen, userEvent } from '@testing-library/react-native';

import { useBannerSlot } from '@e07/shell/app/use-ad-context.ts';
import { createFakeAds } from '@e07/shell/services/ads/fake-ads.ts';
import { createFakeConnectivity } from '@e07/shell/services/connectivity/fake-connectivity.ts';
import { createFakeConsent } from '@e07/shell/services/consent/fake-consent.ts';
import { createFakeErrorLog } from '@e07/shell/services/error-log/fake-error-log.ts';
import { createTestSave, TEST_CLOCK } from '@e07/shell/testing/create-test-save.ts';
import { flushMicrotasks } from '@e07/shell/testing/flush-microtasks.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { AppText } from '@e07/shell/ui/app-text.tsx';

import { ConsentMoment } from './consent-moment.tsx';

import type { DebugServices } from '@e07/shell/screens/debug/debug-services.ts';
import type { ReactNode } from 'react';

// A test build with test ads (TEST_EXPO_CONSTANTS: ADS_MODE=test, the game's ads on).
jest.mock(
  'expo-constants',
  () =>
    jest.requireActual<Record<string, unknown>>('@e07/shell/testing/test-game-extra.ts')[
      'TEST_EXPO_CONSTANTS'
    ],
);

/** Home's banner slot: it asks for the ad moment and shows whether its banner may load. */
function MockHome(): ReactNode {
  const banner = useBannerSlot('home');
  return <AppText testID="probe.banner" text={banner.isAllowed ? 'banner' : 'no banner'} />;
}

type Options = { readonly isHeld?: boolean; readonly debug?: DebugServices | null };

/**
 * A player past the tutorial, online, in a region where Google's form is required, on an iPhone
 * whose tracking answer is still not-determined (the player declines when asked).
 */
async function renderMoment(options: Options = {}) {
  const calls: string[] = [];
  const { save } = createTestSave();
  save.update((doc) => ({
    ...doc,
    firstRun: { ...doc.firstRun, languageChosen: true, tutorialDone: true },
  }));
  const services = {
    save,
    clock: TEST_CLOCK,
    errorLog: createFakeErrorLog(TEST_CLOCK),
    connectivity: createFakeConnectivity(true),
    consent: createFakeConsent({
      afterRefresh: { canRequestAds: false, isPrivacyOptionsRequired: true },
      afterForm: { canRequestAds: true, isPrivacyOptionsRequired: true },
      tracking: 'not-determined',
      calls,
    }),
    ads: createFakeAds({
      rewardedStatus: 'unavailable',
      interstitialResult: 'unavailable',
      rewardResult: 'unavailable',
      calls,
    }),
  };
  await renderWithShell(
    <ConsentMoment isHeld={options.isHeld ?? false} debug={options.debug ?? null}>
      <MockHome />
    </ConsentMoment>,
    { services },
  );
  await act(flushMicrotasks);
  return { calls, save };
}

describe('ConsentMoment', () => {
  it('shows S3 over Home, then Google form, ATT, initialize and preload after Continue', async () => {
    const user = userEvent.setup();
    const { calls, save } = await renderMoment();
    expect(screen.getByTestId('consent.screen')).toBeOnTheScreen();
    expect(calls).toStrictEqual(['refresh']);
    await user.press(screen.getByRole('button', { name: 'Choose options' }));
    await act(flushMicrotasks);
    expect(calls).toStrictEqual([
      'refresh',
      'showFormIfRequired',
      'requestTracking',
      'initialize',
      'preloadInterstitial',
      'preloadRewarded',
    ]);
    expect(screen.queryByTestId('consent.screen')).toBeNull();
    // The answer is saved for the next launch and reaches the banner at once.
    expect(save.doc().ads.consent.canRequestAds).toBe(true);
    expect(screen.getByTestId('probe.banner')).toHaveTextContent('banner');
  });

  it('holds the S3 parity frame on screen and asks neither Google nor Apple', async () => {
    const user = userEvent.setup();
    const { calls } = await renderMoment({ isHeld: true });
    await user.press(screen.getByRole('button', { name: 'Choose options' }));
    await act(flushMicrotasks);
    expect(screen.getByTestId('consent.screen')).toBeOnTheScreen();
    expect(calls).toStrictEqual([]);
  });

  it('asks nothing while the debug switch "Never show ads" is on', async () => {
    const debug = { adsOverride: () => 'never' } as unknown as DebugServices;
    const { calls } = await renderMoment({ debug });
    expect(screen.queryByTestId('consent.screen')).toBeNull();
    expect(calls).toStrictEqual([]);
  });
});
