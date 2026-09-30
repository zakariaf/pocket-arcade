// packages/shell/src/services/ads/ads-port.ts
import type { ReactNode } from 'react';

export type AdUnitIds = {
  readonly banner: string;
  readonly interstitial: string;
  readonly rewarded: string;
};
export type FullscreenResult = 'shown' | 'unavailable';
export type RewardResult = 'rewarded' | 'dismissed' | 'unavailable';
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
  readonly isRewardedLoaded: () => boolean;
  // Notifies when rewarded availability changes, so "Watch an ad" buttons appear/disappear.
  readonly subscribeRewardedLoaded: (listener: (isLoaded: boolean) => void) => () => void;
  // Resolve when the ad CLOSED (or immediately with 'unavailable'). Never reject.
  readonly showInterstitial: () => Promise<FullscreenResult>;
  readonly showRewarded: () => Promise<RewardResult>;
  readonly renderBanner: (props: BannerSlotProps) => ReactNode;
};
