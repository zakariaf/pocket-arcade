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
const ANDROID = {
  appId: `ca-app-pub-${PUB}~0987654321`,
  units: {
    banner: `ca-app-pub-${PUB}/4444444444`,
    interstitial: `ca-app-pub-${PUB}/5555555555`,
    rewarded: `ca-app-pub-${PUB}/6666666666`,
  },
};
const IOS_ONLY: AdmobGameIds = { ...LIVE, android: null };

describe('ads config', () => {
  it.each(['test', 'off'] as const)('keeps real IDs out of %s builds', (mode) => {
    expect(admobPluginOptions(mode, LIVE, []).iosAppId).toBe(GOOGLE_SAMPLE_APP_IDS.ios);
    expect(adUnitsExtra(mode, LIVE)).toBeNull();
  });

  it('uses the game IDs in live builds', () => {
    expect(admobPluginOptions('live', LIVE, []).iosAppId).toBe(LIVE.ios.appId);
    expect(adUnitsExtra('live', LIVE)?.ios).toStrictEqual(LIVE.ios.units);
  });

  it('accepts a game without Android IDs yet (iOS first)', () => {
    expect(admobPluginOptions('live', IOS_ONLY, []).iosAppId).toBe(LIVE.ios.appId);
    expect(adUnitsExtra('live', IOS_ONLY)?.ios).toStrictEqual(LIVE.ios.units);
  });

  it('rejects sample or malformed IDs in live builds', () => {
    const sample = { ...LIVE, ios: { ...LIVE.ios, appId: GOOGLE_SAMPLE_APP_IDS.ios } };
    expect(() => admobPluginOptions('live', sample, [])).toThrow(/invalid live AdMob ids/);
    const malformed = { ...LIVE, ios: { ...LIVE.ios, units: { ...LIVE.ios.units, banner: 'x' } } };
    expect(() => admobPluginOptions('live', malformed, [])).toThrow(/invalid live AdMob ids/);
  });
});

// Spec 8.8: test builds use Google's test ad IDs and real IDs appear only in store builds. On
// Android the same holds per platform: the Android app id and units come from ads.ids.android.
describe('ads config on Android', () => {
  it.each(['test', 'off'] as const)("gives %s builds Google's Android sample app id", (mode) => {
    expect(admobPluginOptions(mode, LIVE, []).androidAppId).toBe(GOOGLE_SAMPLE_APP_IDS.android);
    expect(admobPluginOptions(mode, IOS_ONLY, []).androidAppId).toBe(GOOGLE_SAMPLE_APP_IDS.android);
  });

  it("uses the game's Android app id in live builds", () => {
    expect(admobPluginOptions('live', LIVE, []).androidAppId).toBe(ANDROID.appId);
  });

  it("gives a live build without Android ids no Android app id at all, never Google's sample", () => {
    const options = admobPluginOptions('live', IOS_ONLY, []);
    expect(options).not.toHaveProperty('androidAppId');
    expect(JSON.stringify(options)).not.toContain('3940256099942544');
    expect(options.iosAppId).toBe(LIVE.ios.appId);
  });

  it('embeds the live unit ids per platform, so Android never shows the iOS units', () => {
    expect(adUnitsExtra('live', LIVE)).toStrictEqual({
      ios: LIVE.ios.units,
      android: ANDROID.units,
    });
    expect(adUnitsExtra('live', IOS_ONLY)).toStrictEqual({ ios: LIVE.ios.units, android: null });
  });

  it('rejects sample or malformed Android ids in live builds', () => {
    const sample = { ...LIVE, android: { ...ANDROID, appId: GOOGLE_SAMPLE_APP_IDS.android } };
    expect(() => admobPluginOptions('live', sample, [])).toThrow(/invalid live AdMob ids/);
    const malformed = {
      ...LIVE,
      android: { ...ANDROID, units: { ...ANDROID.units, rewarded: 'x' } },
    };
    expect(() => adUnitsExtra('live', malformed)).toThrow(/invalid live AdMob ids/);
  });
});
