// packages/shell/src/services/ads/ads-factory.ts
// Chooses the AdsPort implementation from expo.extra (written by withShell at build time).
import { ADMOB_TEST_UNITS, createAdmobAdsAdapter } from './admob-ads-adapter.ts';
import { createFakeAds } from './fake-ads.ts';

import type { AdFailure } from './admob-ads-adapter.ts';
import type { AdsPort, AdUnitIds } from './ads-port.ts';

export type AdsExtra = {
  readonly adsMode: 'off' | 'test' | 'live';
  readonly adUnits: AdUnitIds | null; // only when live
};

export function createAdsPort(extra: AdsExtra, onAdError: (error: AdFailure) => void): AdsPort {
  if (extra.adsMode === 'off') {
    // Spec 4.3 / screenshots / E2E: every slot stays empty, nothing is ever requested.
    return createFakeAds({
      isRewardedLoaded: false,
      interstitialResult: 'unavailable',
      rewardResult: 'unavailable',
      calls: [],
    });
  }
  const units = extra.adsMode === 'live' ? extra.adUnits : ADMOB_TEST_UNITS;
  if (units === null) throw new Error('ADS_MODE=live without extra.adUnits (withShell bug)');
  return createAdmobAdsAdapter({ units, onAdError });
}
