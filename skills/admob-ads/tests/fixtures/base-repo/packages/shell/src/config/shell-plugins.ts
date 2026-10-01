// packages/shell/src/config/shell-plugins.ts (fixture: the Shell's one native plugin list, Shell step 8)
import { admobPluginOptions } from './ads-config.ts';
import { SKADNETWORK_IDS } from './skadnetwork-ids.ts';

import type { AdsMode } from './app-variant.ts';
import type { AdmobGameIds } from './ads-config.ts';

export function shellPlugins(ids: AdmobGameIds, adsMode: AdsMode): unknown[] {
  return [
    'expo-sqlite',
    'expo-iap',
    ['react-native-google-mobile-ads', admobPluginOptions(adsMode, ids, SKADNETWORK_IDS)],
    ['expo-tracking-transparency', { userTrackingPermission: 'Google uses this to show you ads.' }],
  ];
}
