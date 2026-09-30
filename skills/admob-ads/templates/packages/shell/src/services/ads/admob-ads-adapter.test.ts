// packages/shell/src/services/ads/admob-ads-adapter.test.ts — drives the ads adapter against the root
// __mocks__. Lint bans importing the SDK outside the adapters, so the test reads the mock with
// jest.requireMock (after an explicit jest.mock, so it is the instance the adapter imported).
import { createAdmobAdsAdapter } from './admob-ads-adapter.ts';

import type { AdUnitIds } from './ads-port.ts';

jest.mock('react-native-google-mobile-ads');

type Listener = (payload?: unknown) => void;
type MockAd = {
  loaded: boolean;
  readonly destroy: jest.Mock;
  readonly addAdEventListener: jest.Mock<() => void, [string, Listener]>;
};
type AdFactory = { readonly createForAdRequest: jest.Mock<MockAd, [string]> };
type MockedSdk = {
  readonly InterstitialAd: AdFactory;
  readonly RewardedAd: AdFactory;
  readonly AdEventType: { readonly CLOSED: string; readonly ERROR: string };
  readonly RewardedAdEventType: { readonly EARNED_REWARD: string };
};

const sdk = jest.requireMock<MockedSdk>('react-native-google-mobile-ads');

const UNITS: AdUnitIds = {
  banner: 'ca-app-pub-1234567890123456/1111111111',
  interstitial: 'ca-app-pub-1234567890123456/2222222222',
  rewarded: 'ca-app-pub-1234567890123456/3333333333',
};

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

describe('createAdmobAdsAdapter', () => {
  it('settles "unavailable" when an interstitial fails to present (ERROR, no CLOSED)', async () => {
    const ads = createAdmobAdsAdapter({ units: UNITS, onAdError: jest.fn() });
    const ad = loadedAd(sdk.InterstitialAd, ads.preloadInterstitial);

    const shown = ads.showInterstitial();
    fire(ad, sdk.AdEventType.ERROR, { phase: 'show', reason: 'internal-error' });

    await expect(shown).resolves.toBe('unavailable');
    expect(ad.destroy).toHaveBeenCalled();
  });

  it('reports "shown" once the interstitial closes', async () => {
    const ads = createAdmobAdsAdapter({ units: UNITS, onAdError: jest.fn() });
    const ad = loadedAd(sdk.InterstitialAd, ads.preloadInterstitial);

    const shown = ads.showInterstitial();
    fire(ad, sdk.AdEventType.CLOSED);

    await expect(shown).resolves.toBe('shown');
  });

  it('grants a reward only after EARNED_REWARD', async () => {
    const ads = createAdmobAdsAdapter({ units: UNITS, onAdError: jest.fn() });
    const skipped = loadedAd(sdk.RewardedAd, ads.preloadRewarded);
    const dismissed = ads.showRewarded();
    fire(skipped, sdk.AdEventType.CLOSED);
    await expect(dismissed).resolves.toBe('dismissed');

    const watched = loadedAd(sdk.RewardedAd, ads.preloadRewarded);
    const rewarded = ads.showRewarded();
    fire(watched, sdk.RewardedAdEventType.EARNED_REWARD, { type: 'perk', amount: 1 });
    fire(watched, sdk.AdEventType.CLOSED);
    await expect(rewarded).resolves.toBe('rewarded');
  });

  it('shows nothing before an ad has loaded', async () => {
    const ads = createAdmobAdsAdapter({ units: UNITS, onAdError: jest.fn() });
    ads.preloadRewarded();

    await expect(ads.showRewarded()).resolves.toBe('unavailable');
    expect(ads.isRewardedLoaded()).toBe(false);
  });
});
