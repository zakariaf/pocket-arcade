// packages/shell/src/services/ads/read-ads-extra.ts
import Constants from 'expo-constants';

import type { AdsExtra } from './ads-factory.ts';
import type { AdUnitIds } from './ads-port.ts';

const MODES = ['off', 'test', 'live'] as const;

function isUnitIds(value: unknown): value is AdUnitIds {
  if (typeof value !== 'object' || value === null) return false;
  return ['banner', 'interstitial', 'rewarded'].every(
    (key) => typeof Reflect.get(value, key) === 'string',
  );
}

// expo.extra is embedded in the app at build time (withShell writes adsMode and adUnits).
// Anything unexpected falls back to 'off': a broken config must never show real ads.
export function readAdsExtra(extra: unknown = Constants.expoConfig?.extra): AdsExtra {
  if (typeof extra !== 'object' || extra === null) return { adsMode: 'off', adUnits: null };
  const mode: unknown = Reflect.get(extra, 'adsMode');
  const units: unknown = Reflect.get(extra, 'adUnits');
  const adsMode = MODES.find((candidate) => candidate === mode) ?? 'off';
  return { adsMode, adUnits: isUnitIds(units) ? units : null };
}
