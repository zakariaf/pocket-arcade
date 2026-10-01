// packages/shell/src/services/ads/fake-ads.ts
// Used by Jest, by ADS_MODE=off builds (screenshots, E2E) and by the debug "never show ads".
import type { AdsPort, FullscreenResult, RewardedStatus, RewardResult } from './ads-port.ts';

export type FakeAdsScript = {
  /** What rewardedStatus() answers first; setRewardedStatus changes it and tells subscribers. */
  readonly rewardedStatus: RewardedStatus;
  interstitialResult: FullscreenResult;
  rewardResult: RewardResult;
  readonly calls: string[];
};

/** The scripted port, plus the one way a test moves the rewarded status (loading -> ready...). */
export type FakeAds = AdsPort & { readonly setRewardedStatus: (status: RewardedStatus) => void };

type StatusCell = Pick<FakeAds, 'rewardedStatus' | 'subscribeRewardedStatus' | 'setRewardedStatus'>;

/** The scripted status and its subscribers (useSyncExternalStore). */
function statusCell(initial: RewardedStatus): StatusCell {
  const listeners = new Set<() => void>();
  let status = initial;
  return {
    rewardedStatus: () => status,
    subscribeRewardedStatus: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setRewardedStatus: (next) => {
      status = next;
      listeners.forEach((listener) => {
        listener();
      });
    },
  };
}

export function createFakeAds(script: FakeAdsScript): FakeAds {
  const record = (name: string): void => {
    script.calls.push(name);
  };
  return {
    ...statusCell(script.rewardedStatus),
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
