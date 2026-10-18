// packages/shell/src/app/consent-moment.android.test.tsx — the consent moment where Platform.OS is
// 'android' (the unit-android project), with the real consent port over the root mocks of Google's
// UMP and expo-tracking-transparency: Google's form where it is required, after the S3 intro
// (L10), and never a tracking prompt (L14). Lint bans importing the SDKs in tests, so the test
// reads the mocks with jest.requireMock (after an explicit jest.mock).
import { act, screen, userEvent } from '@testing-library/react-native';
import { BackHandler, DeviceEventEmitter, Platform } from 'react-native';

import { useBannerSlot } from '@e07/shell/app/use-ad-context.ts';
import { createFakeAds } from '@e07/shell/services/ads/fake-ads.ts';
import { createFakeConnectivity } from '@e07/shell/services/connectivity/fake-connectivity.ts';
import { createConsentPort } from '@e07/shell/services/consent/consent-factory.ts';
import { createFakeErrorLog } from '@e07/shell/services/error-log/fake-error-log.ts';
import { createTestSave, TEST_CLOCK } from '@e07/shell/testing/create-test-save.ts';
import { flushMicrotasks } from '@e07/shell/testing/flush-microtasks.ts';
import { renderWithShell } from '@e07/shell/testing/render-with-shell.tsx';
import { AppText } from '@e07/shell/ui/app-text.tsx';

import { ConsentMoment } from './consent-moment.tsx';

import type { ConsentAdsMode } from '@e07/shell/services/consent/consent-factory.ts';
import type { ReactNode } from 'react';

jest.mock('react-native-google-mobile-ads');
jest.mock('expo-tracking-transparency');

// An Android build of the game with ads on; the build's ADS_MODE is the one each test sets.
let mockAdsMode: ConsentAdsMode = 'test';
jest.mock('expo-constants', () => {
  const { TEST_GAME_EXTRA } = jest.requireActual<Record<string, unknown>>(
    '@e07/shell/testing/test-game-extra.ts',
  );
  return {
    __esModule: true,
    default: {
      get expoConfig() {
        return {
          name: 'Line Siege',
          version: '1.0.0',
          android: { versionCode: 8 },
          extra: { adsMode: mockAdsMode, game: TEST_GAME_EXTRA },
        };
      },
    },
  };
});

type MockedSdk = {
  readonly AdsConsent: {
    readonly requestInfoUpdate: jest.Mock<Promise<unknown>>;
    readonly loadAndShowConsentFormIfRequired: jest.Mock<Promise<unknown>>;
  };
};
type MockedTracking = {
  readonly getTrackingPermissionsAsync: jest.Mock<Promise<unknown>>;
  readonly requestTrackingPermissionsAsync: jest.Mock<Promise<unknown>>;
};

const { AdsConsent } = jest.requireMock<MockedSdk>('react-native-google-mobile-ads');
const tracking = jest.requireMock<MockedTracking>('expo-tracking-transparency');

// Google's answers: in the EEA, UK and Switzerland the form is required; elsewhere it is not.
const REQUIRED = {
  status: 'REQUIRED',
  canRequestAds: false,
  privacyOptionsRequirementStatus: 'REQUIRED',
  isConsentFormAvailable: true,
};
const NOT_REQUIRED = {
  status: 'NOT_REQUIRED',
  canRequestAds: true,
  privacyOptionsRequirementStatus: 'NOT_REQUIRED',
  isConsentFormAvailable: false,
};
const OBTAINED = { ...REQUIRED, status: 'OBTAINED', canRequestAds: true };

/** Home's banner slot: it asks for the ad moment and shows whether its banner may load. */
function MockHome(): ReactNode {
  const banner = useBannerSlot('home');
  return <AppText testID="probe.banner" text={banner.isAllowed ? 'banner' : 'no banner'} />;
}

/** A level: no banner slot, so it never asks for the ad moment. */
function MockLevel(): ReactNode {
  return <AppText testID="probe.level" text="level" />;
}

type Options = {
  readonly isFormRequired?: boolean;
  readonly adsMode?: ConsentAdsMode;
  readonly isPremium?: boolean;
  readonly isOnline?: boolean;
  readonly isTutorialDone?: boolean;
  readonly isOnLevel?: boolean;
};

/** A player on Home after the tutorial, online, not Premium, in a test build with test ads. */
async function renderMoment(options: Options = {}): Promise<{ readonly calls: string[] }> {
  mockAdsMode = options.adsMode ?? 'test';
  AdsConsent.requestInfoUpdate.mockResolvedValue(
    (options.isFormRequired ?? true) ? REQUIRED : NOT_REQUIRED,
  );
  AdsConsent.loadAndShowConsentFormIfRequired.mockResolvedValue(OBTAINED);
  const calls: string[] = [];
  const { save } = createTestSave();
  save.update((doc) => ({
    ...doc,
    firstRun: {
      ...doc.firstRun,
      languageChosen: true,
      tutorialDone: options.isTutorialDone ?? true,
    },
  }));
  const errorLog = createFakeErrorLog(TEST_CLOCK);
  const services = {
    save,
    clock: TEST_CLOCK,
    errorLog,
    connectivity: createFakeConnectivity(options.isOnline ?? true),
    consent: createConsentPort(mockAdsMode, {
      onError: (error) => {
        errorLog.record('ads', String(error));
      },
    }),
    ads: createFakeAds({
      rewardedStatus: 'unavailable',
      interstitialResult: 'unavailable',
      rewardResult: 'unavailable',
      calls,
    }),
  };
  await renderWithShell(
    <ConsentMoment isHeld={false} debug={null}>
      {options.isOnLevel === true ? <MockLevel /> : <MockHome />}
    </ConsentMoment>,
    { services, isPremium: options.isPremium ?? false },
  );
  await act(flushMicrotasks);
  return { calls };
}

type HostNode = { readonly parent: HostNode | null; readonly props: Record<string, unknown> };

/** The nearest ancestor that hides its subtree from TalkBack (Android's focus trap), if any. */
function trapAbove(node: HostNode): HostNode | null {
  for (let at = node.parent; at !== null; at = at.parent) {
    if (at.props['importantForAccessibility'] === 'no-hide-descendants') return at;
  }
  return null;
}

function expectNoTrackingPrompt(): void {
  expect(tracking.getTrackingPermissionsAsync).not.toHaveBeenCalled();
  expect(tracking.requestTrackingPermissionsAsync).not.toHaveBeenCalled();
}

// Spec 8.8 and 4.2 point 2: Google's consent form where it is required, before any ad request;
// L10: the S3 intro comes only right before Google's form; L14: no tracking prompt on Android.
describe('ConsentMoment on Android', () => {
  it('runs where Platform.OS is android', () => {
    expect(Platform.OS).toBe('android');
  });

  it("shows S3, then Google's form after Continue, then initializes with no tracking step", async () => {
    const user = userEvent.setup();
    const { calls } = await renderMoment();
    expect(screen.getByTestId('consent.screen')).toBeOnTheScreen();
    expect(AdsConsent.loadAndShowConsentFormIfRequired).not.toHaveBeenCalled();
    expect(calls).toStrictEqual([]);

    await user.press(screen.getByRole('button', { name: 'Choose options' }));
    await act(flushMicrotasks);

    expect(AdsConsent.loadAndShowConsentFormIfRequired).toHaveBeenCalledTimes(1);
    expect(calls).toStrictEqual(['initialize', 'preloadInterstitial', 'preloadRewarded']);
    expectNoTrackingPrompt();
    expect(screen.queryByTestId('consent.screen')).toBeNull();
    expect(screen.getByTestId('probe.banner')).toHaveTextContent('banner');
  });

  it('keeps S3 up on the system back, and the press never reaches the navigator under it (spec 5, S3)', async () => {
    // S3 has no Back control and is no route: the spec's "system back does what Back does" leaves
    // nothing to do, and the press must not go back on the screen under the cover.
    const exitApp = jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => undefined);
    const navigatorBack = jest.fn(() => true);
    const subscription = BackHandler.addEventListener('hardwareBackPress', navigatorBack);
    try {
      const { calls } = await renderMoment();
      await act(() => {
        DeviceEventEmitter.emit('hardwareBackPress', {});
      });
      await act(flushMicrotasks);

      expect(screen.getByTestId('consent.screen')).toBeOnTheScreen();
      expect(navigatorBack).not.toHaveBeenCalled();
      expect(exitApp).not.toHaveBeenCalled();
      expect(AdsConsent.loadAndShowConsentFormIfRequired).not.toHaveBeenCalled();
      expect(calls).toStrictEqual([]);
    } finally {
      subscription.remove();
    }
  });

  it('hides the screen behind S3 from TalkBack, and shows it again after (spec 8.11, S3)', async () => {
    // The cover's accessibilityViewIsModal is iOS-only; TalkBack walked from S3 onto Home behind it.
    const user = userEvent.setup();
    await renderMoment();
    const behind = screen.getByTestId('probe.banner', { includeHiddenElements: true });
    const cover = screen.getByTestId('consent.screen');
    expect([trapAbove(behind) !== null, trapAbove(cover) !== null]).toStrictEqual([true, false]);

    await user.press(screen.getByRole('button', { name: 'Choose options' }));
    await act(flushMicrotasks);
    const home = screen.getByTestId('probe.banner');
    expect(trapAbove(home) !== null).toBe(false);
  });

  it('initializes with no intro, no form and no prompt where the form is not required', async () => {
    const { calls } = await renderMoment({ isFormRequired: false });
    expect(screen.queryByTestId('consent.screen')).toBeNull();
    expect(AdsConsent.loadAndShowConsentFormIfRequired).not.toHaveBeenCalled();
    expect(calls).toStrictEqual(['initialize', 'preloadInterstitial', 'preloadRewarded']);
    expectNoTrackingPrompt();
    expect(screen.getByTestId('probe.banner')).toHaveTextContent('banner');
  });

  it.each([
    ['with ads off', { adsMode: 'off' }],
    ['with Premium', { isPremium: true }],
    ['offline', { isOnline: false }],
    ['before the tutorial is done', { isTutorialDone: false }],
    ['during a level', { isOnLevel: true }],
  ] as const)('asks nothing and loads no ad %s', async (_when, options) => {
    const { calls } = await renderMoment(options);
    expect(screen.queryByTestId('consent.screen')).toBeNull();
    expect(AdsConsent.loadAndShowConsentFormIfRequired).not.toHaveBeenCalled();
    expect(calls).toStrictEqual([]);
    expectNoTrackingPrompt();
  });
});
