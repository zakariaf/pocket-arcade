// packages/shell/src/services/consent/consent-factory.ts
// Chooses the ConsentPort from the build's ADS_MODE (expo.extra.adsMode, read by readAdsExtra).
// An ADS_MODE=off build (screenshots, E2E, the runtime network audit, a game with ads switched off)
// never touches Google's UMP: its consent-info update is a network request from the app process.
import { createAdmobConsentAdapter } from './admob-consent-adapter.ts';
import { createFakeConsent } from './fake-consent.ts';

import type { AdmobConsentOptions } from './admob-consent-adapter.ts';
import type { ConsentInfo, ConsentPort } from './consent-port.ts';

export type ConsentAdsMode = 'off' | 'test' | 'live';

// No ads: nothing may be requested, and there is no "Ad privacy choices" row to show.
const NO_ADS: ConsentInfo = { canRequestAds: false, isPrivacyOptionsRequired: false };

export function createConsentPort(
  adsMode: ConsentAdsMode,
  options: AdmobConsentOptions,
): ConsentPort {
  if (adsMode === 'off') {
    return createFakeConsent({ afterRefresh: NO_ADS, afterForm: NO_ADS, calls: [] });
  }
  return createAdmobConsentAdapter(options);
}
