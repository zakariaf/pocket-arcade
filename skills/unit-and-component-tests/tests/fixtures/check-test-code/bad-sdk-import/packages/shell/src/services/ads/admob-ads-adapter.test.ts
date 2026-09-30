import { InterstitialAd } from 'react-native-google-mobile-ads';

import { createAdmobAdsAdapter } from './admob-ads-adapter.ts';

describe('createAdmobAdsAdapter', () => {
  it('creates one interstitial per request', () => {
    createAdmobAdsAdapter({ onError: jest.fn() }).preloadInterstitial();
    expect(InterstitialAd.createForAdRequest).toHaveBeenCalledTimes(1);
  });
});
