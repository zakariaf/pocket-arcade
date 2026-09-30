// packages/shell/src/services/ads/admob-ads-adapter.ts
import mobileAds from 'react-native-google-mobile-ads';

import type { AdsPort } from './ads-port.ts';

/** The only file that imports the AdMob SDK. */
export function createAdmobAdsAdapter(): AdsPort {
  return { initialize: async () => { await mobileAds().initialize(); } };
}
