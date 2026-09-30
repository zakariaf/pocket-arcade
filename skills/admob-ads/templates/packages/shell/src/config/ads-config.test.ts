// packages/shell/src/config/ads-config.test.ts
import { admobPluginOptions, adUnitsExtra, GOOGLE_SAMPLE_APP_IDS } from './ads-config.ts';

import type { AdmobGameIds } from './ads-config.ts';

const PUB = '1234567890123456';
const LIVE: AdmobGameIds = {
  ios: {
    appId: `ca-app-pub-${PUB}~1234567890`,
    units: {
      banner: `ca-app-pub-${PUB}/1111111111`,
      interstitial: `ca-app-pub-${PUB}/2222222222`,
      rewarded: `ca-app-pub-${PUB}/3333333333`,
    },
  },
  android: {
    appId: `ca-app-pub-${PUB}~0987654321`,
    units: {
      banner: `ca-app-pub-${PUB}/4444444444`,
      interstitial: `ca-app-pub-${PUB}/5555555555`,
      rewarded: `ca-app-pub-${PUB}/6666666666`,
    },
  },
};

describe('ads config', () => {
  it.each(['test', 'off'] as const)('keeps real IDs out of %s builds', (mode) => {
    expect(admobPluginOptions(mode, LIVE, []).iosAppId).toBe(GOOGLE_SAMPLE_APP_IDS.ios);
    expect(adUnitsExtra(mode, LIVE)).toBeNull();
  });

  it('uses the game IDs in live builds', () => {
    expect(admobPluginOptions('live', LIVE, []).iosAppId).toBe(LIVE.ios.appId);
    expect(adUnitsExtra('live', LIVE)).toStrictEqual(LIVE.ios.units);
  });

  it('accepts a game without Android IDs yet (iOS first)', () => {
    const iosOnly = { ...LIVE, android: null };
    expect(admobPluginOptions('live', iosOnly, []).androidAppId).toBe(
      GOOGLE_SAMPLE_APP_IDS.android,
    );
  });

  it('rejects sample or malformed IDs in live builds', () => {
    const sample = { ...LIVE, ios: { ...LIVE.ios, appId: GOOGLE_SAMPLE_APP_IDS.ios } };
    expect(() => admobPluginOptions('live', sample, [])).toThrow(/invalid live AdMob ids/);
    const malformed = { ...LIVE, ios: { ...LIVE.ios, units: { ...LIVE.ios.units, banner: 'x' } } };
    expect(() => admobPluginOptions('live', malformed, [])).toThrow(/invalid live AdMob ids/);
  });
});
