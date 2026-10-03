// packages/shell/src/services/ads/ads-port.ts
import type { ReactNode } from 'react';

export type AdUnitIds = {
  readonly banner: string;
  readonly interstitial: string;
  readonly rewarded: string;
};
export type FullscreenResult = 'shown' | 'unavailable';
export type RewardResult = 'rewarded' | 'dismissed' | 'unavailable';
/**
 * Where the rewarded ad stands (L11): 'loading' from the start of a preload until LOADED or a load
 * error; 'ready' after LOADED; 'unavailable' after a load error until the next preload starts, after
 * the loaded ad was shown, with ads off and before initialize. So a hidden offer always means the
 * ad cannot come, never that it is still on its way.
 */
export type RewardedStatus = 'loading' | 'ready' | 'unavailable';
export type BannerSlotProps = {
  readonly onLoaded: () => void; // the slot collapses until this fires (no empty box)
  readonly onFailed: () => void; // failed loads are silent (spec 8.8)
};

// The Shell's view of an ad SDK. Only admob-ads-adapter.ts touches the real SDK.
export type AdsPort = {
  // After consent: request configuration + SDK initialize. Idempotent.
  readonly initialize: () => Promise<void>;
  readonly preloadInterstitial: () => void;
  readonly preloadRewarded: () => void;
  readonly rewardedStatus: () => RewardedStatus;
  // Notifies when rewardedStatus() changes (useSyncExternalStore's subscribe), so the "Watch an ad"
  // offer shows its loading state, turns ready, or goes away.
  readonly subscribeRewardedStatus: (listener: () => void) => () => void;
  // Resolve when the ad CLOSED (or immediately with 'unavailable'). Never reject.
  readonly showInterstitial: () => Promise<FullscreenResult>;
  readonly showRewarded: () => Promise<RewardResult>;
  readonly renderBanner: (props: BannerSlotProps) => ReactNode;
};
