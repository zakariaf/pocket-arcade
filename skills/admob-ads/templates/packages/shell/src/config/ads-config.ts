// packages/shell/src/config/ads-config.ts
// Runs in Node inside app.config.ts (type stripping): erasable TypeScript, explicit .ts imports.
// ADS_MODE itself is resolved and validated by app-variant.ts (APP_VARIANT x ADS_MODE matrix).
import type { AdsMode } from './app-variant.ts';

export type AdmobUnitIds = {
  readonly banner: string;
  readonly interstitial: string;
  readonly rewarded: string;
};
export type AdmobPlatformIds = { readonly appId: string; readonly units: AdmobUnitIds };
// iOS ships first: the Android AdMob app may not exist yet (null until Android starts).
export type AdmobGameIds = {
  readonly ios: AdmobPlatformIds;
  readonly android: AdmobPlatformIds | null;
};

const GOOGLE_SAMPLE_PUBLISHER = '3940256099942544';
// Google's sample app IDs (developers.google.com/admob/ios/test-ads, .../android/test-ads).
export const GOOGLE_SAMPLE_APP_IDS = {
  ios: `ca-app-pub-${GOOGLE_SAMPLE_PUBLISHER}~1458002511`,
  android: `ca-app-pub-${GOOGLE_SAMPLE_PUBLISHER}~3347511713`,
} as const;

const APP_ID = /^ca-app-pub-\d{16}~\d{10}$/;
const UNIT_ID = /^ca-app-pub-\d{16}\/\d{10}$/;

export function assertLiveIds(ids: AdmobPlatformIds): void {
  const units = Object.values(ids.units);
  const isValid = APP_ID.test(ids.appId) && units.every((unit) => UNIT_ID.test(unit));
  const isSample = [ids.appId, ...units].some((id) => id.includes(GOOGLE_SAMPLE_PUBLISHER));
  if (!isValid || isSample) throw new Error(`invalid live AdMob ids: ${JSON.stringify(ids)}`);
}

export type AdmobPluginOptions = {
  readonly iosAppId: string;
  readonly androidAppId: string;
  readonly delayAppMeasurementInit: true;
  readonly skAdNetworkItems: readonly string[];
};

// The SDK is linked in every variant, so Info.plist always needs an app ID (missing = crash).
// No userTrackingUsageDescription: decision D4 = no App Tracking Transparency prompt in v1.
export function admobPluginOptions(
  mode: AdsMode,
  ids: AdmobGameIds,
  skAdNetworkItems: readonly string[],
): AdmobPluginOptions {
  const isLive = mode === 'live';
  if (isLive) assertLiveIds(ids.ios);
  if (isLive && ids.android !== null) assertLiveIds(ids.android);
  return {
    iosAppId: isLive ? ids.ios.appId : GOOGLE_SAMPLE_APP_IDS.ios,
    androidAppId:
      isLive && ids.android !== null ? ids.android.appId : GOOGLE_SAMPLE_APP_IDS.android,
    delayAppMeasurementInit: true,
    skAdNetworkItems,
  };
}

// withShell writes this as expo.extra.adUnits. Real unit IDs reach the runtime ONLY when live.
export function adUnitsExtra(mode: AdsMode, ids: AdmobGameIds): AdmobUnitIds | null {
  if (mode !== 'live') return null;
  assertLiveIds(ids.ios);
  return ids.ios.units;
}
