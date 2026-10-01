// packages/shell/src/services/consent/admob-consent-debug-adapter.ts
// Test builds only. Imported by nothing but the Shell's test-only entry (the debug menu, S15), which
// store builds compile out. Resetting consent or opening the Ad Inspector changes consent behaviour
// for real players, so these calls never live in admob-consent-adapter.ts.
// Apple's tracking answer (ATT) has no reset: it comes back only after deleting the app, or through
// Settings > Privacy & Security > Tracking. resetConsent resets Google's UMP answer alone.
import mobileAds, { AdsConsent } from 'react-native-google-mobile-ads';

import type { AdsConsentUserChoices } from 'react-native-google-mobile-ads';

export type ConsentDebugTools = {
  readonly resetConsent: () => void; // start the UMP flow over on this device
  readonly readUserChoices: () => Promise<AdsConsentUserChoices>; // decoded TCF choices
  readonly openAdInspector: () => Promise<void>; // why an ad did not show (test units only)
};

export function createAdmobConsentDebugAdapter(): ConsentDebugTools {
  return {
    resetConsent: () => {
      AdsConsent.reset();
    },
    readUserChoices: () => AdsConsent.getUserChoices(),
    openAdInspector: () => mobileAds().openAdInspector(),
  };
}
