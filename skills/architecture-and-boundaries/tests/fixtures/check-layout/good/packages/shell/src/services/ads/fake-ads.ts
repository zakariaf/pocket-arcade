// packages/shell/src/services/ads/fake-ads.ts
import type { AdsPort } from './ads-port.ts';

/** In-memory AdsPort. */
export function createFakeAds(): AdsPort {
  return { initialize: async () => undefined };
}
