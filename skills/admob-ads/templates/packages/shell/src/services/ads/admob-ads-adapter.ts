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

import type { AdsPort, AdUnitIds, FullscreenResult, RewardResult } from './ads-port.ts';
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
type Loaded = { readonly notify: (isLoaded: boolean) => void };

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

function showRewarded(slot: Cell<RewardedAd | null>, loaded: Loaded): Promise<RewardResult> {
  const ad = slot.get();
  if (ad?.loaded !== true) return Promise.resolve('unavailable');
  slot.set(null);
  loaded.notify(false);
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

function preloadInterstitial(slot: Cell<InterstitialAd | null>, options: AdmobAdsOptions): void {
  if (slot.get() !== null) return;
  const ad = InterstitialAd.createForAdRequest(options.units.interstitial);
  slot.set(ad);
  ad.addAdEventListener(AdEventType.ERROR, (error) => {
    reportAdError(error, options);
    ad.destroy();
    slot.set(null);
  });
  ad.load();
}

function preloadRewarded(
  slot: Cell<RewardedAd | null>,
  options: AdmobAdsOptions,
  loaded: Loaded,
): void {
  if (slot.get() !== null) return;
  const ad = RewardedAd.createForAdRequest(options.units.rewarded);
  slot.set(ad);
  ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
    loaded.notify(true);
  });
  ad.addAdEventListener(AdEventType.ERROR, (error) => {
    reportAdError(error, options);
    ad.destroy();
    slot.set(null);
    loaded.notify(false);
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

function createLoadedListeners(): Loaded & Pick<AdsPort, 'subscribeRewardedLoaded'> {
  const listeners = new Set<(isLoaded: boolean) => void>();
  return {
    notify: (isLoaded) => {
      listeners.forEach((listener) => {
        listener(isLoaded);
      });
    },
    subscribeRewardedLoaded: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function createAdmobAdsAdapter(options: AdmobAdsOptions): AdsPort {
  const interstitial = cell<InterstitialAd | null>(null);
  const rewarded = cell<RewardedAd | null>(null);
  const isInitialized = cell(false);
  const loaded = createLoadedListeners();
  return {
    initialize: () => initializeOnce(isInitialized),
    preloadInterstitial: () => {
      preloadInterstitial(interstitial, options);
    },
    preloadRewarded: () => {
      preloadRewarded(rewarded, options, loaded);
    },
    isRewardedLoaded: () => rewarded.get()?.loaded === true,
    subscribeRewardedLoaded: loaded.subscribeRewardedLoaded,
    showInterstitial: () => showInterstitial(interstitial),
    showRewarded: () => showRewarded(rewarded, loaded),
    renderBanner: ({ onLoaded, onFailed }) =>
      createElement(BannerAd, {
        unitId: options.units.banner,
        size: BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER,
        onAdLoaded: onLoaded,
        onAdFailedToLoad: onFailed,
      }),
  };
}
