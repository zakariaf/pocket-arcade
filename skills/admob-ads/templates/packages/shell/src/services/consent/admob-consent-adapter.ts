// packages/shell/src/services/consent/admob-consent-adapter.ts
// Google UMP through react-native-google-mobile-ads. The form content comes from the AdMob
// console (published GDPR/TCF message); the Shell only decides WHEN it appears (spec S3).
// Apple's App Tracking Transparency prompt (guideline 5.1.2(i)) comes through expo-tracking-
// transparency; this file is its only importer. No IDFA explainer message is published in the
// AdMob console (step A3): UMP would then run its own ATT flow next to this one.
import {
  getTrackingPermissionsAsync,
  PermissionStatus,
  requestTrackingPermissionsAsync,
} from 'expo-tracking-transparency';
import { AppState, Platform } from 'react-native';
import {
  AdsConsent,
  AdsConsentDebugGeography,
  AdsConsentPrivacyOptionsRequirementStatus,
} from 'react-native-google-mobile-ads';

import type { ConsentInfo, ConsentPort, TrackingStatus } from './consent-port.ts';
import type { PermissionResponse } from 'expo-tracking-transparency';
import type { AdsConsentInfo } from 'react-native-google-mobile-ads';

/** The consent geography a test build asks UMP to assume (the debug link's geo=eea|other). */
export type DebugGeography = 'eea' | 'other';
export type AdmobConsentOptions = {
  /**
   * Test builds only, and only through debugServices.setConsentGeography (e2e-maestro: the debug
   * link's geo=): UMP answers as for a player in the EEA (S3, then Google's form) or elsewhere
   * (Apple's prompt alone), on any network. Store builds never pass it (check-ads rule
   * debug-geography-test-only).
   */
  readonly debugGeography?: DebugGeography;
  /** Test builds only: UMP test devices (a simulator is one already; a phone needs its id). */
  readonly testDeviceIdentifiers?: readonly string[];
  readonly onError: (error: unknown) => void;
};

const GEOGRAPHY = {
  eea: AdsConsentDebugGeography.EEA,
  other: AdsConsentDebugGeography.OTHER,
} as const;

/** requestInfoUpdate's debug settings: none in a store build. */
function debugSettings(options: AdmobConsentOptions): {
  readonly debugGeography?: number;
  readonly testDeviceIdentifiers?: string[];
} {
  const { debugGeography: geography, testDeviceIdentifiers: devices } = options;
  return {
    ...(geography === undefined ? {} : { debugGeography: GEOGRAPHY[geography] }),
    ...(devices === undefined ? {} : { testDeviceIdentifiers: [...devices] }),
  };
}

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

// expo-tracking-transparency 57.0.2 reports ATTrackingManager's .restricted as 'denied', exactly
// like a declined prompt (TrackingTransparencyPermissionRequester.swift), so this adapter never
// returns 'restricted'; both mean ads without the IDFA.
function toTrackingStatus(response: PermissionResponse): TrackingStatus {
  if (response.status === PermissionStatus.GRANTED) return 'authorized';
  if (response.status === PermissionStatus.DENIED) return 'denied';
  return 'not-determined';
}

// Apple shows the prompt only while the app is active; asked in any other state it answers at
// once without asking, so the request waits for the app to come back.
function whenActive(): Promise<void> {
  if (AppState.currentState === 'active') return Promise.resolve();
  return new Promise((resolve) => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      subscription.remove();
      resolve();
    });
  });
}

async function requestTracking(onError: (error: unknown) => void): Promise<TrackingStatus> {
  if (Platform.OS !== 'ios') return 'unavailable';
  try {
    const current = toTrackingStatus(await getTrackingPermissionsAsync());
    if (current !== 'not-determined') return current; // asked before: Apple never asks twice
    await whenActive();
    return toTrackingStatus(await requestTrackingPermissionsAsync());
  } catch (error) {
    onError(error);
    return 'unavailable'; // ads still load, without the IDFA
  }
}

export function createAdmobConsentAdapter(options: AdmobConsentOptions): ConsentPort {
  const requestOptions = debugSettings(options);
  return {
    refresh: () =>
      withCachedFallback(() => AdsConsent.requestInfoUpdate(requestOptions), options.onError),
    showFormIfRequired: () =>
      withCachedFallback(() => AdsConsent.loadAndShowConsentFormIfRequired(), options.onError),
    showPrivacyOptions: () =>
      withCachedFallback(() => AdsConsent.showPrivacyOptionsForm(), options.onError),
    requestTracking: () => requestTracking(options.onError),
  };
}
