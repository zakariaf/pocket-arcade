// packages/shell/src/services/ads/fake-ads.ts
// Used by Jest, by ADS_MODE=off builds (screenshots, E2E) and by the debug "never show ads".
import type { AdsPort, FullscreenResult, RewardResult } from './ads-port.ts';

export type FakeAdsScript = {
  isRewardedLoaded: boolean;
  interstitialResult: FullscreenResult;
  rewardResult: RewardResult;
  readonly calls: string[];
};

export function createFakeAds(script: FakeAdsScript): AdsPort {
  const record = (name: string): void => {
    script.calls.push(name);
  };
  return {
    initialize: () => {
      record('initialize');
      return Promise.resolve();
    },
    preloadInterstitial: () => {
      record('preloadInterstitial');
    },
    preloadRewarded: () => {
      record('preloadRewarded');
    },
    isRewardedLoaded: () => script.isRewardedLoaded,
    subscribeRewardedLoaded: () => () => undefined,
    showInterstitial: () => {
      record('showInterstitial');
      return Promise.resolve(script.interstitialResult);
    },
    showRewarded: () => {
      record('showRewarded');
      return Promise.resolve(script.rewardResult);
    },
    renderBanner: () => null,
  };
}
