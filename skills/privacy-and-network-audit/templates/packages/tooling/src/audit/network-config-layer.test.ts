// packages/tooling/src/audit/network-config-layer.test.ts
import { configProblems } from './network-config-layer.ts';

import type { ExpoConfigLike } from './network-config-layer.ts';

const STORE: ExpoConfigLike = { updates: { enabled: false }, plugins: ['expo-iap'] };

describe('configProblems (layer E)', () => {
  it('accepts the bare expo-iap entry with OTA updates off', () => {
    expect(configProblems(STORE)).toStrictEqual([]);
  });

  it.each([
    ['an Onside module', { ...STORE, plugins: [['expo-iap', { module: 'onside' }]] }],
    ['an empty options object', { ...STORE, plugins: [['expo-iap', {}]] }],
    ['ios.onside.enabled', { ...STORE, ios: { onside: { enabled: true } } }],
    [
      'an ATT usage description',
      {
        ...STORE,
        plugins: [['react-native-google-mobile-ads', { userTrackingUsageDescription: 'x' }]],
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

  it('requires updates.enabled to be exactly false', () => {
    expect(configProblems({ plugins: ['expo-iap'] })).toStrictEqual([
      'expo.updates.enabled must be false',
    ]);
  });
});
