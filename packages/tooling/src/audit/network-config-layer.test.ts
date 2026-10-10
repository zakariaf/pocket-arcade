// packages/tooling/src/audit/network-config-layer.test.ts
import { configProblems } from './network-config-layer.ts';

import type { ExpoConfigLike } from './network-config-layer.ts';

const TEXT = 'Google uses this to show you ads that fit your interests.';
const LOCALES = Object.fromEntries(
  ['en', 'de', 'fa', 'ckb'].map((lang) => [
    lang,
    { ios: { NSUserTrackingUsageDescription: TEXT } },
  ]),
);
const STORE: ExpoConfigLike = {
  updates: { enabled: false },
  plugins: [
    'expo-iap',
    ['react-native-google-mobile-ads', { iosAppId: 'x' }],
    ['expo-tracking-transparency', { userTrackingPermission: TEXT }],
  ],
  locales: LOCALES,
};

describe('configProblems (layer E)', () => {
  it('accepts the bare expo-iap entry, OTA updates off and the tracking text in four languages', () => {
    expect(configProblems(STORE)).toStrictEqual([]);
  });

  it.each([
    [
      'an Onside module',
      {
        ...STORE,
        plugins: [['expo-iap', { module: 'onside' }], ...(STORE.plugins ?? []).slice(1)],
      },
    ],
    ['ios.onside.enabled', { ...STORE, ios: { onside: { enabled: true } } }],
    [
      "the AdMob plugin's own tracking text (a second source)",
      {
        ...STORE,
        plugins: [
          'expo-iap',
          ['react-native-google-mobile-ads', { userTrackingUsageDescription: 'x' }],
          ['expo-tracking-transparency', { userTrackingPermission: TEXT }],
        ],
      },
    ],
    [
      'arbitrary loads',
      {
        ...STORE,
        ios: { infoPlist: { NSAppTransportSecurity: { NSAllowsArbitraryLoads: true } } },
      },
    ],
  ] as const)('flags %s', (_label, config: ExpoConfigLike) => {
    expect(configProblems(config)).toHaveLength(1);
  });

  it('requires the tracking plugin with its text when ads are enabled (O1)', () => {
    const plugins = ['expo-iap', ['react-native-google-mobile-ads', {}]] as const;
    expect(configProblems({ ...STORE, plugins })).toStrictEqual([
      'expo-tracking-transparency plugin with userTrackingPermission is missing (ATT)',
    ]);
  });

  it('requires the tracking text in en, de, fa and ckb', () => {
    const locales = { ...LOCALES, fa: { ios: {} }, ckb: 'ckb.json' };
    expect(configProblems({ ...STORE, locales })).toStrictEqual([
      'locales.fa.ios.NSUserTrackingUsageDescription is missing',
      'locales.ckb.ios.NSUserTrackingUsageDescription is missing',
    ]);
  });

  it('asks for no tracking text in a game without ads', () => {
    const noAds = { ...STORE, plugins: ['expo-iap'], locales: {} };
    expect(configProblems(noAds)).toStrictEqual([]);
    const adsOff = {
      ...STORE,
      locales: {},
      extra: { game: { adPolicy: { isAdsEnabled: false } } },
    };
    expect(configProblems(adsOff)).toStrictEqual([]);
  });

  it('requires updates.enabled to be exactly false', () => {
    expect(configProblems({ ...STORE, updates: {} })).toStrictEqual([
      'expo.updates.enabled must be false',
    ]);
  });
});
