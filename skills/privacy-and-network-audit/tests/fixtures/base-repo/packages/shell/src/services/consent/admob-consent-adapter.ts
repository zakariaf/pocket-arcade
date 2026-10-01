// packages/shell/src/services/consent/admob-consent-adapter.ts (fixture: the one file that asks
// for App Tracking Transparency, owner decision O1)
import { getTrackingPermissionsAsync, requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { AdsConsent } from 'react-native-google-mobile-ads';

export const consentApis = [AdsConsent, getTrackingPermissionsAsync, requestTrackingPermissionsAsync];
