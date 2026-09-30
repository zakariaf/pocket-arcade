// packages/shell/src/services/ads/ads-factory.test.ts
import { createAdsPort } from './ads-factory.ts';

const LIVE_UNITS = {
  banner: 'ca-app-pub-1234567890123456/1111111111',
  interstitial: 'ca-app-pub-1234567890123456/2222222222',
  rewarded: 'ca-app-pub-1234567890123456/3333333333',
};

describe('createAdsPort', () => {
  it('returns an adapter that never shows anything when ADS_MODE=off', async () => {
    const ads = createAdsPort({ adsMode: 'off', adUnits: null }, () => undefined);
    await expect(ads.showInterstitial()).resolves.toBe('unavailable');
    expect(ads.isRewardedLoaded()).toBe(false);
  });

  it('refuses live mode without unit IDs', () => {
    expect(() => createAdsPort({ adsMode: 'live', adUnits: null }, () => undefined)).toThrow(
      /extra.adUnits/,
    );
  });

  it('builds the AdMob adapter in test and live modes', async () => {
    for (const extra of [
      { adsMode: 'test', adUnits: null },
      { adsMode: 'live', adUnits: LIVE_UNITS },
    ] as const) {
      const ads = createAdsPort(extra, () => undefined);
      await expect(ads.showRewarded()).resolves.toBe('unavailable');
    }
  });
});
