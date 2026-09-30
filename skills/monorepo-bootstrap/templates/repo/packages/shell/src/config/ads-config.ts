// packages/shell/src/config/ads-config.ts
// Runs in Node inside app.config.ts (type stripping): erasable TypeScript, explicit .ts imports.
// ADS_MODE itself is resolved and validated by app-variant.ts.
// Phase 0 (monorepo-bootstrap): admob-ads' ads-config.ts replaces this file with the AdMob plugin
// options at the Shell's native step.
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
const APP_ID = /^ca-app-pub-\d{16}~\d{10}$/;
const UNIT_ID = /^ca-app-pub-\d{16}\/\d{10}$/;

/** Throws unless the IDs are real AdMob IDs in the documented format (never Google's samples). */
export function assertLiveIds(ids: AdmobPlatformIds): void {
  const units = Object.values(ids.units);
  const isValid = APP_ID.test(ids.appId) && units.every((unit) => UNIT_ID.test(unit));
  const isSample = [ids.appId, ...units].some((id) => id.includes(GOOGLE_SAMPLE_PUBLISHER));
  if (!isValid || isSample) throw new Error(`invalid live AdMob ids: ${JSON.stringify(ids)}`);
}

/** withShell writes this as expo.extra.adUnits. Real unit IDs reach the runtime ONLY when live. */
export function adUnitsExtra(mode: AdsMode, ids: AdmobGameIds): AdmobUnitIds | null {
  if (mode !== 'live') {
    return null;
  }
  assertLiveIds(ids.ios);
  return ids.ios.units;
}
