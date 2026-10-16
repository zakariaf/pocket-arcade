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
  // Absent only in a live build without the game's Android ids (owner step GP5): never the sample.
  readonly androidAppId?: string;
  readonly delayAppMeasurementInit: true;
  readonly skAdNetworkItems: readonly string[];
};

// The SDK is linked in every variant, so Info.plist always needs an app ID (missing = crash).
// A live build without ads.ids.android gets no Android app id at all, never Google's sample: an
// Android build of it is unusable and the Android gates name owner step GP5, while iOS releases of
// a game that is not on Android yet still build.
// No userTrackingUsageDescription: Apple's ATT text (owner decision O1) has one writer, the
// expo-tracking-transparency plugin entry and withShell's locales (shell-plugins.ts, with-shell.ts).
export function admobPluginOptions(
  mode: AdsMode,
  ids: AdmobGameIds,
  skAdNetworkItems: readonly string[],
): AdmobPluginOptions {
  const isLive = mode === 'live';
  if (isLive) assertLiveIds(ids.ios);
  if (isLive && ids.android !== null) assertLiveIds(ids.android);
  const androidAppId = isLive ? ids.android?.appId : GOOGLE_SAMPLE_APP_IDS.android;
  return {
    iosAppId: isLive ? ids.ios.appId : GOOGLE_SAMPLE_APP_IDS.ios,
    ...(androidAppId === undefined ? {} : { androidAppId }),
    delayAppMeasurementInit: true,
    skAdNetworkItems,
  };
}

// The live units per platform: readAdsExtra picks Platform.OS's entry, so an Android build never
// shows ads from the iOS units (null until the game's Android AdMob app exists, owner step GP5).
export type AdUnitsExtra = {
  readonly ios: AdmobUnitIds;
  readonly android: AdmobUnitIds | null;
};

// withShell writes this as expo.extra.adUnits. Real unit IDs reach the runtime ONLY when live.
export function adUnitsExtra(mode: AdsMode, ids: AdmobGameIds): AdUnitsExtra | null {
  if (mode !== 'live') return null;
  assertLiveIds(ids.ios);
  if (ids.android !== null) assertLiveIds(ids.android);
  return { ios: ids.ios.units, android: ids.android?.units ?? null };
}
