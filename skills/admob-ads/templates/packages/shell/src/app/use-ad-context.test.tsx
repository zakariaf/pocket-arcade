// packages/shell/src/app/use-ad-context.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { createFakeAds } from '@e07/shell/services/ads/fake-ads.ts';
import { createFakeConnectivity } from '@e07/shell/services/connectivity/fake-connectivity.ts';
import { createTestSave } from '@e07/shell/testing/create-test-save.ts';
import { createShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';

import { ConsentMomentContext } from './consent-moment-context.tsx';
import {
  debugAdPolicy,
  ForcedAdPlacementsContext,
  useAdContext,
  useBannerSlot,
  useHintPerk,
} from './use-ad-context.ts';

import type { FakeConnectivity } from '@e07/shell/services/connectivity/fake-connectivity.ts';
import type { ShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';
import type { ReactNode } from 'react';

jest.mock(
  'expo-constants',
  () =>
    jest.requireActual<Record<string, unknown>>('@e07/shell/testing/test-game-extra.ts')[
      'TEST_EXPO_CONSTANTS'
    ],
);

const ADS = createFakeAds({
  rewardedStatus: 'unavailable',
  interstitialResult: 'unavailable',
  rewardResult: 'unavailable',
  calls: [],
});

type ReadyShell = ShellWrapper & { readonly connectivity: FakeConnectivity };

/** A player past the tutorial with the given connectivity and last consent answer. */
function readyShell(isOnline: boolean, canRequestAds: boolean | null): ReadyShell {
  const connectivity = createFakeConnectivity(isOnline);
  const { save } = createTestSave();
  save.update((doc) => ({
    ...doc,
    firstRun: { ...doc.firstRun, languageChosen: true, tutorialDone: true },
    ads: { ...doc.ads, consent: { ...doc.ads.consent, canRequestAds } },
  }));
  return { ...createShellWrapper({ services: { connectivity, ads: ADS, save } }), connectivity };
}

describe('useAdContext', () => {
  it('gathers Premium, connectivity, consent, the tutorial and the levels won', async () => {
    const shell = readyShell(true, true);
    const { result } = await renderHook(() => useAdContext('home'), { wrapper: shell.wrapper });

    expect(result.current).toStrictEqual({
      isPremium: false,
      isOnline: true,
      canRequestAds: true,
      isTutorialDone: true,
      levelsCompletedTotal: 0,
    });
  });

  it('follows connectivity live and treats a consent never asked as no consent', async () => {
    const shell = readyShell(false, null);
    const { result } = await renderHook(() => useAdContext('levels'), { wrapper: shell.wrapper });
    expect(result.current).toMatchObject({ isOnline: false, canRequestAds: false });

    await act(() => {
      shell.connectivity.setOnline(true);
    });
    expect(result.current.isOnline).toBe(true);
  });
});

describe('useAdContext with the consent moment', () => {
  it('reads the live consent answer, not the saved one', async () => {
    const shell = readyShell(true, null);
    const moment = { requestAdMoment: () => () => undefined, canRequestAds: true };
    function WithMoment({ children }: { readonly children: ReactNode }): ReactNode {
      return (
        <shell.wrapper>
          <ConsentMomentContext value={moment}>{children}</ConsentMomentContext>
        </shell.wrapper>
      );
    }
    const { result } = await renderHook(() => useAdContext('home'), { wrapper: WithMoment });
    expect(result.current.canRequestAds).toBe(true);
  });
});

describe('useBannerSlot', () => {
  it('asks the consent moment for its ad moment while the banner screen is open', async () => {
    const shell = readyShell(true, true);
    const release = jest.fn();
    const requestAdMoment = jest.fn(() => release);
    function WithMoment({ children }: { readonly children: ReactNode }): ReactNode {
      return (
        <shell.wrapper>
          <ConsentMomentContext value={{ requestAdMoment, canRequestAds: true }}>
            {children}
          </ConsentMomentContext>
        </shell.wrapper>
      );
    }
    const { unmount } = await renderHook(() => useBannerSlot('home'), { wrapper: WithMoment });
    expect([requestAdMoment.mock.calls.length, release.mock.calls.length]).toStrictEqual([1, 0]);
    await unmount();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('allows the Home banner only when the policy does, and never for Premium owners', async () => {
    const shell = readyShell(true, true);
    const { result } = await renderHook(() => useBannerSlot('home'), { wrapper: shell.wrapper });
    expect(result.current).toStrictEqual({ renderBanner: ADS.renderBanner, isAllowed: true });

    await act(() => {
      shell.stores.premium.getState().dispatch({ type: 'premium-granted' });
    });
    expect(result.current.isAllowed).toBe(false);
  });

  it('keeps the banner closed offline or without consent', async () => {
    const shell = readyShell(false, true);
    const { result } = await renderHook(() => useBannerSlot('stats'), { wrapper: shell.wrapper });
    expect(result.current.isAllowed).toBe(false);
  });

  it('opens a placement the test-build harness forces, and only that one', async () => {
    const shell = readyShell(false, null);
    function Forced({ children }: { readonly children: ReactNode }): ReactNode {
      return (
        <shell.wrapper>
          <ForcedAdPlacementsContext value={['home']}>{children}</ForcedAdPlacementsContext>
        </shell.wrapper>
      );
    }
    const { result: home } = await renderHook(() => useBannerSlot('home'), { wrapper: Forced });
    const { result: levels } = await renderHook(() => useBannerSlot('levels'), { wrapper: Forced });
    expect([home.current.isAllowed, levels.current.isAllowed]).toStrictEqual([true, false]);
  });
});

describe('useHintPerk', () => {
  it('gives no free hint to a game whose config allows none (hints.freePerDay 0)', async () => {
    // TEST_EXPO_CONSTANTS is the pilot's config: Line Siege has no solver hints, freePerDay 0.
    const shell = readyShell(true, true);
    const { result } = await renderHook(() => useHintPerk('2026-09-26'), {
      wrapper: shell.wrapper,
    });
    expect(result.current).toStrictEqual({ kind: 'hint', freeHintsLeft: 0 });
  });
});

describe('debugAdPolicy', () => {
  const CONFIG = {
    isAdsEnabled: true,
    minLevelsCompletedBeforeFirst: 3,
    minMsBetweenInterstitials: 180_000,
    minLevelsCompletedBetween: 2,
  };

  it('leaves the policy alone without a debug switch', () => {
    expect(debugAdPolicy(CONFIG, null)).toBe(CONFIG);
  });

  it('switches ads off for "Never show ads"', () => {
    expect(debugAdPolicy(CONFIG, 'never').isAdsEnabled).toBe(false);
  });

  it('drops the pacing for "Always show test ads" but never turns a disabled build on', () => {
    expect(debugAdPolicy(CONFIG, 'always-test')).toStrictEqual({
      isAdsEnabled: true,
      minLevelsCompletedBeforeFirst: 0,
      minMsBetweenInterstitials: 0,
      minLevelsCompletedBetween: 0,
    });
    expect(debugAdPolicy({ ...CONFIG, isAdsEnabled: false }, 'always-test').isAdsEnabled).toBe(
      false,
    );
  });
});
