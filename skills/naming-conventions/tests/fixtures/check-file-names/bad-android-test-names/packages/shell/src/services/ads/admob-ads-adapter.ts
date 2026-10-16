// packages/shell/src/services/ads/admob-ads-adapter.ts
import type { AdsPort } from './ads-port.ts';

/** The AdMob adapter. */
export function createAdmobAdsAdapter(): AdsPort {
  return { initialize: async () => undefined };
}
