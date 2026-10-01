// packages/shell/src/services/ads/admob-ads-adapter.ts
// With admob-consent-adapter.ts, the ONLY files allowed to import react-native-google-mobile-ads.
// Deliberate: classic create/load/show API behind AdsPort. Do not "upgrade" to the v17 hooks or
// pools: the Shell preloads at quiet moments and applies frequency caps in pure code (ad-policy.ts).
import { createElement } from 'react';
import mobileAds, {
  AdEventType,
  BannerAd,
  BannerAdSize,
  InterstitialAd,
  MaxAdContentRating,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

import type {
  AdsPort,
  AdUnitIds,
  FullscreenResult,
  RewardedStatus,
  RewardResult,
} from './ads-port.ts';
import type { AdErrorPayload } from 'react-native-google-mobile-ads';

export type AdFailure = Error & AdErrorPayload;
export type AdmobAdsOptions = {
  readonly units: AdUnitIds; // ADMOB_TEST_UNITS when ADS_MODE=test, extra.adUnits when live
  readonly onAdError: (error: AdFailure) => void; // ErrorLogPort; never shown to the player
};

// Google's demo units (ADS_MODE=test). Platform-aware; never hard-code them elsewhere.
export const ADMOB_TEST_UNITS: AdUnitIds = {
  banner: TestIds.ADAPTIVE_BANNER,
  interstitial: TestIds.INTERSTITIAL,
  rewarded: TestIds.REWARDED,
};

type Cell<T> = { readonly get: () => T; readonly set: (value: T) => void };
/** The rewarded status with its listeners (AdsPort.subscribeRewardedStatus). */
type StatusCell = Cell<RewardedStatus> & {
  readonly subscribe: (listener: () => void) => () => void;
};

function cell<T>(initial: T): Cell<T> {
  let value = initial;
  return { get: () => value, set: (next) => (value = next) };
}

// Load-phase no-fill is routine inventory; show-phase failures and real errors are logged.
function reportAdError(error: AdFailure, options: AdmobAdsOptions): void {
  const isNoFill = error.reason === 'no-fill' || error.reason === 'mediation-no-fill';
  if (error.phase === 'show' || !isNoFill) options.onAdError(error);
}

function showInterstitial(slot: Cell<InterstitialAd | null>): Promise<FullscreenResult> {
  const ad = slot.get();
  if (ad?.loaded !== true) return Promise.resolve('unavailable');
  slot.set(null);
  return new Promise((resolve) => {
    const settle = (result: FullscreenResult): void => {
      ad.destroy();
      resolve(result);
    };
    ad.addAdEventListener(AdEventType.CLOSED, () => {
      settle('shown');
    });
    // A failed presentation arrives only as ERROR (phase 'show'): show() has already resolved and
    // CLOSED never comes, so without this listener the game would stay suspended forever.
    ad.addAdEventListener(AdEventType.ERROR, () => {
      settle('unavailable');
    });
    ad.show().catch(() => {
      settle('unavailable'); // not loaded / already showing / platform declined
    });
  });
}

function showRewarded(slot: Cell<RewardedAd | null>, status: StatusCell): Promise<RewardResult> {
  const ad = slot.get();
  if (ad?.loaded !== true) return Promise.resolve('unavailable');
  slot.set(null);
  status.set('unavailable'); // shown once; ad-moments starts the next preload after it closes
  const earned = cell(false);
  return new Promise((resolve) => {
    const settle = (result: RewardResult): void => {
      ad.destroy();
      resolve(result);
    };
    ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      earned.set(true); // grant ONLY on this event, never on CLOSED alone
    });
    ad.addAdEventListener(AdEventType.CLOSED, () => {
      settle(earned.get() ? 'rewarded' : 'dismissed');
    });
    // Failed presentation: ERROR (phase 'show') and no CLOSED; see showInterstitial.
    ad.addAdEventListener(AdEventType.ERROR, () => {
      settle(earned.get() ? 'rewarded' : 'unavailable');
    });
    ad.show().catch(() => {
      settle('unavailable');
    });
  });
}

type Loading = { readonly options: AdmobAdsOptions; readonly isInitialized: Cell<boolean> };

// Ads load only after initialize (which follows consent): an earlier preload starts nothing.
function preloadInterstitial(slot: Cell<InterstitialAd | null>, loading: Loading): void {
  const { options } = loading;
  if (!loading.isInitialized.get() || slot.get() !== null) return;
  const ad = InterstitialAd.createForAdRequest(options.units.interstitial);
  slot.set(ad);
  ad.addAdEventListener(AdEventType.ERROR, (error) => {
    reportAdError(error, options);
    ad.destroy();
    slot.set(null);
  });
  ad.load();
}

// 'loading' from here until LOADED ('ready') or a load error ('unavailable' until the next preload).
function preloadRewarded(
  slot: Cell<RewardedAd | null>,
  loading: Loading,
  status: StatusCell,
): void {
  const { options } = loading;
  if (!loading.isInitialized.get() || slot.get() !== null) return;
  const ad = RewardedAd.createForAdRequest(options.units.rewarded);
  slot.set(ad);
  status.set('loading');
  ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
    status.set('ready');
  });
  ad.addAdEventListener(AdEventType.ERROR, (error) => {
    reportAdError(error, options);
    ad.destroy();
    slot.set(null);
    status.set('unavailable');
  });
  ad.load();
}

async function initializeOnce(isInitialized: Cell<boolean>): Promise<void> {
  if (isInitialized.get()) return;
  // D8: general audience, not child-directed -> no ageRestrictedTreatment signal.
  await mobileAds().setRequestConfiguration({ maxAdContentRating: MaxAdContentRating.PG });
  await mobileAds().initialize();
  isInitialized.set(true);
}

/** 'unavailable' until the first preload after initialize; listeners hear every change. */
function createStatusCell(): StatusCell {
  let status: RewardedStatus = 'unavailable';
  const listeners = new Set<() => void>();
  return {
    get: () => status,
    set: (next) => {
      if (next === status) return;
      status = next;
      listeners.forEach((listener) => {
        listener();
      });
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function createAdmobAdsAdapter(options: AdmobAdsOptions): AdsPort {
  const interstitial = cell<InterstitialAd | null>(null);
  const rewarded = cell<RewardedAd | null>(null);
  const isInitialized = cell(false);
  const loading = { options, isInitialized };
  const status = createStatusCell();
  return {
    initialize: () => initializeOnce(isInitialized),
    preloadInterstitial: () => {
      preloadInterstitial(interstitial, loading);
    },
    preloadRewarded: () => {
      preloadRewarded(rewarded, loading, status);
    },
    rewardedStatus: status.get,
    subscribeRewardedStatus: status.subscribe,
    showInterstitial: () => showInterstitial(interstitial),
    showRewarded: () => showRewarded(rewarded, status),
    renderBanner: ({ onLoaded, onFailed }) =>
      createElement(BannerAd, {
        unitId: options.units.banner,
        size: BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER,
        onAdLoaded: onLoaded,
        onAdFailedToLoad: onFailed,
      }),
  };
}
