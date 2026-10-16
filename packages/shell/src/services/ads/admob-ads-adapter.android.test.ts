// packages/shell/src/services/ads/admob-ads-adapter.android.test.ts — the ads adapter where
// Platform.OS is 'android' (the unit-android project), against the root __mocks__. Lint bans
// importing the SDK outside the adapters, so the test reads the mock with jest.requireMock (after an
// explicit jest.mock, so it is the instance the adapter imported).
// no-shell-context: the banner element comes from the adapter alone and reads no Shell state.
import { render } from '@testing-library/react-native';
import { createElement, Fragment } from 'react';
import { Platform } from 'react-native';

import { createAdsPort } from './ads-factory.ts';
import { runFullscreenAd } from './fullscreen-ad.ts';
import { readAdsExtra } from './read-ads-extra.ts';

import type { AdsPort, AdUnitIds } from './ads-port.ts';
import type { GameLifecycle } from './fullscreen-ad.ts';

jest.mock('react-native-google-mobile-ads');

type Listener = (payload?: unknown) => void;
type MockAd = {
  loaded: boolean;
  readonly show: jest.Mock<Promise<void>, []>;
  readonly destroy: jest.Mock;
  readonly addAdEventListener: jest.Mock<() => void, [string, Listener]>;
};
type AdFactory = { readonly createForAdRequest: jest.Mock<MockAd, [string]> };
type BannerComponent = (props: { readonly unitId: string }) => null;
type MockedSdk = {
  readonly BannerAd: BannerComponent;
  readonly InterstitialAd: AdFactory;
  readonly RewardedAd: AdFactory;
  readonly AdEventType: { readonly CLOSED: string; readonly ERROR: string };
  readonly RewardedAdEventType: { readonly EARNED_REWARD: string; readonly LOADED: string };
};

const sdk = jest.requireMock<MockedSdk>('react-native-google-mobile-ads');

// Google's Android demo units (the library's TestIds on Android).
const GOOGLE_ANDROID_TEST_UNITS: AdUnitIds = {
  banner: 'ca-app-pub-3940256099942544/9214589741',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
};
const IOS_UNITS: AdUnitIds = {
  banner: 'ca-app-pub-1234567890123456/1111111111',
  interstitial: 'ca-app-pub-1234567890123456/2222222222',
  rewarded: 'ca-app-pub-1234567890123456/3333333333',
};
const ANDROID_UNITS: AdUnitIds = {
  banner: 'ca-app-pub-1234567890123456/4444444444',
  interstitial: 'ca-app-pub-1234567890123456/5555555555',
  rewarded: 'ca-app-pub-1234567890123456/6666666666',
};

function lastUnit(factory: AdFactory): string | undefined {
  return factory.createForAdRequest.mock.calls.at(-1)?.[0];
}

function lastAd(factory: AdFactory): MockAd {
  const result = factory.createForAdRequest.mock.results.at(-1);
  if (result?.type !== 'return') throw new Error('no ad was created');
  return result.value;
}

// Fires one SDK event on the listeners the adapter registered.
function fire(ad: MockAd, type: string, payload?: unknown): void {
  ad.addAdEventListener.mock.calls
    .filter(([eventType]) => eventType === type)
    .forEach(([, listener]) => {
      listener(payload);
    });
}

function loadedAd(factory: AdFactory, preload: () => void): MockAd {
  preload();
  const ad = lastAd(factory);
  ad.loaded = true; // what the SDK does on LOADED
  return ad;
}

async function unitsLoadedBy(ads: AdsPort): Promise<AdUnitIds> {
  await ads.initialize();
  ads.preloadInterstitial();
  ads.preloadRewarded();
  const banner = jest.spyOn(sdk, 'BannerAd');
  await render(
    createElement(Fragment, null, ads.renderBanner({ onLoaded: jest.fn(), onFailed: jest.fn() })),
  );
  return {
    banner: banner.mock.calls.at(-1)?.[0].unitId ?? '',
    interstitial: lastUnit(sdk.InterstitialAd) ?? '',
    rewarded: lastUnit(sdk.RewardedAd) ?? '',
  };
}

function recordingLifecycle(): { readonly lifecycle: GameLifecycle; readonly calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    lifecycle: {
      suspend: (reason) => calls.push(`suspend:${reason}`),
      resume: (reason) => calls.push(`resume:${reason}`),
    },
  };
}

// Spec 8.8: test builds use Google's test ad IDs, and real IDs appear only in store builds; on
// Android those are the game's Android units, never the iOS ones.
describe('createAdsPort on Android', () => {
  it('runs where Platform.OS is android', () => {
    expect(Platform.OS).toBe('android');
  });

  it("loads Google's Android test units in a test build", async () => {
    const ads = createAdsPort({ adsMode: 'test', adUnits: null }, jest.fn());
    await expect(unitsLoadedBy(ads)).resolves.toStrictEqual(GOOGLE_ANDROID_TEST_UNITS);
  });

  it("loads the game's Android units in a live build, never the iOS ones", async () => {
    const extra = readAdsExtra({
      adsMode: 'live',
      adUnits: { ios: IOS_UNITS, android: ANDROID_UNITS },
    });
    const ads = createAdsPort(extra, jest.fn());
    await expect(unitsLoadedBy(ads)).resolves.toStrictEqual(ANDROID_UNITS);
  });
});

// Spec 8.8 and N8: the game pauses around every fullscreen ad. On Android the ad runs in its own
// Activity, and every show still settles, so the game always resumes the same run.
describe('runFullscreenAd with the AdMob adapter on Android', () => {
  async function showingInterstitial(): Promise<{
    readonly ad: MockAd;
    readonly calls: string[];
    readonly shown: Promise<string>;
  }> {
    const ads = createAdsPort({ adsMode: 'test', adUnits: null }, jest.fn());
    await ads.initialize();
    const ad = loadedAd(sdk.InterstitialAd, ads.preloadInterstitial);
    const { lifecycle, calls } = recordingLifecycle();
    const shown = runFullscreenAd(lifecycle, () => {
      calls.push('show');
      return ads.showInterstitial();
    });
    return { ad, calls, shown };
  }

  it('pauses the game while the interstitial shows and resumes it when the ad closes', async () => {
    const { ad, calls, shown } = await showingInterstitial();
    expect(calls).toStrictEqual(['suspend:fullscreen-ad', 'show']);
    fire(ad, sdk.AdEventType.CLOSED);
    await expect(shown).resolves.toBe('shown');
    expect(calls).toStrictEqual(['suspend:fullscreen-ad', 'show', 'resume:fullscreen-ad']);
  });

  it('settles and resumes when the ad fails to present (ERROR, no CLOSED)', async () => {
    const { ad, calls, shown } = await showingInterstitial();
    fire(ad, sdk.AdEventType.ERROR, { phase: 'show', reason: 'internal-error' });
    await expect(shown).resolves.toBe('unavailable');
    expect(calls.at(-1)).toBe('resume:fullscreen-ad');
  });

  it('settles and resumes when show() itself is rejected', async () => {
    const ads = createAdsPort({ adsMode: 'test', adUnits: null }, jest.fn());
    await ads.initialize();
    const ad = loadedAd(sdk.InterstitialAd, ads.preloadInterstitial);
    ad.show.mockRejectedValueOnce(new Error('the activity is finishing'));
    const { lifecycle, calls } = recordingLifecycle();
    await expect(runFullscreenAd(lifecycle, () => ads.showInterstitial())).resolves.toBe(
      'unavailable',
    );
    expect(calls).toStrictEqual(['suspend:fullscreen-ad', 'resume:fullscreen-ad']);
  });

  it('grants the reward only on EARNED_REWARD', async () => {
    const ads = createAdsPort({ adsMode: 'test', adUnits: null }, jest.fn());
    await ads.initialize();
    const { lifecycle } = recordingLifecycle();

    const skipped = loadedAd(sdk.RewardedAd, ads.preloadRewarded);
    const dismissed = runFullscreenAd(lifecycle, () => ads.showRewarded());
    fire(skipped, sdk.AdEventType.CLOSED);
    await expect(dismissed).resolves.toBe('dismissed');

    const watched = loadedAd(sdk.RewardedAd, ads.preloadRewarded);
    const rewarded = runFullscreenAd(lifecycle, () => ads.showRewarded());
    fire(watched, sdk.RewardedAdEventType.EARNED_REWARD, { type: 'perk', amount: 1 });
    fire(watched, sdk.AdEventType.CLOSED);
    await expect(rewarded).resolves.toBe('rewarded');
  });
});
