// packages/shell/src/services/ads/read-ads-extra.ts
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { AdsExtra } from './ads-factory.ts';
import type { AdUnitIds } from './ads-port.ts';

const MODES = ['off', 'test', 'live'] as const;

function isUnitIds(value: unknown): value is AdUnitIds {
  if (typeof value !== 'object' || value === null) return false;
  return ['banner', 'interstitial', 'rewarded'].every(
    (key) => typeof Reflect.get(value, key) === 'string',
  );
}

// withShell embeds the live units per platform ({ ios, android }, adUnitsExtra): this platform's
// entry only, so an Android build never shows ads from the iOS units (spec 8.8, F3).
function unitsFor(units: unknown, os: string): AdUnitIds | null {
  if (typeof units !== 'object' || units === null) return null;
  const mine: unknown = Reflect.get(units, os);
  return isUnitIds(mine) ? mine : null;
}

// expo.extra is embedded in the app at build time (withShell writes adsMode and adUnits).
// Anything unexpected falls back to 'off': a broken config must never show real ads.
export function readAdsExtra(
  extra: unknown = Constants.expoConfig?.extra,
  os: string = Platform.OS,
): AdsExtra {
  if (typeof extra !== 'object' || extra === null) return { adsMode: 'off', adUnits: null };
  const mode: unknown = Reflect.get(extra, 'adsMode');
  const adsMode = MODES.find((candidate) => candidate === mode) ?? 'off';
  return { adsMode, adUnits: unitsFor(Reflect.get(extra, 'adUnits'), os) };
}
