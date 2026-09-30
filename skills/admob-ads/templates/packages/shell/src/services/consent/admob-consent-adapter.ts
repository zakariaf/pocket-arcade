// packages/shell/src/services/consent/admob-consent-adapter.ts
// Google UMP through react-native-google-mobile-ads. The form content comes from the AdMob
// console (published GDPR/TCF message); the Shell only decides WHEN it appears (spec S3).
import {
  AdsConsent,
  AdsConsentDebugGeography,
  AdsConsentPrivacyOptionsRequirementStatus,
} from 'react-native-google-mobile-ads';

import type { ConsentInfo, ConsentPort } from './consent-port.ts';
import type { AdsConsentInfo } from 'react-native-google-mobile-ads';

export type DebugGeography = 'eea' | 'regulated-us-state' | 'other';
export type AdmobConsentOptions = {
  // Test variant only (debug menu, via TEST_ONLY). The store variant passes nothing.
  readonly debugGeography?: DebugGeography;
  readonly onError: (error: unknown) => void;
};

const GEOGRAPHY = {
  eea: AdsConsentDebugGeography.EEA,
  'regulated-us-state': AdsConsentDebugGeography.REGULATED_US_STATE,
  other: AdsConsentDebugGeography.OTHER,
} as const;

function toInfo(info: AdsConsentInfo): ConsentInfo {
  return {
    canRequestAds: info.canRequestAds,
    isPrivacyOptionsRequired:
      info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
  };
}

// Google: if the update fails, still use canRequestAds from the previous session.
async function withCachedFallback(
  action: () => Promise<AdsConsentInfo>,
  onError: (error: unknown) => void,
): Promise<ConsentInfo> {
  try {
    return toInfo(await action());
  } catch (error) {
    onError(error);
    return toInfo(await AdsConsent.getConsentInfo());
  }
}

export function createAdmobConsentAdapter(options: AdmobConsentOptions): ConsentPort {
  const geography = options.debugGeography;
  const requestOptions = geography === undefined ? {} : { debugGeography: GEOGRAPHY[geography] };
  return {
    refresh: () =>
      withCachedFallback(() => AdsConsent.requestInfoUpdate(requestOptions), options.onError),
    showFormIfRequired: () =>
      withCachedFallback(() => AdsConsent.loadAndShowConsentFormIfRequired(), options.onError),
    showPrivacyOptions: () =>
      withCachedFallback(() => AdsConsent.showPrivacyOptionsForm(), options.onError),
  };
}
