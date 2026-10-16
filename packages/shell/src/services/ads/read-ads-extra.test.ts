// packages/shell/src/services/ads/read-ads-extra.test.ts
import { readAdsExtra } from './read-ads-extra.ts';

const UNITS = {
  banner: 'ca-app-pub-1234567890123456/1111111111',
  interstitial: 'ca-app-pub-1234567890123456/2222222222',
  rewarded: 'ca-app-pub-1234567890123456/3333333333',
};
const ANDROID_UNITS = {
  banner: 'ca-app-pub-1234567890123456/4444444444',
  interstitial: 'ca-app-pub-1234567890123456/5555555555',
  rewarded: 'ca-app-pub-1234567890123456/6666666666',
};

describe('readAdsExtra', () => {
  it('reads the mode and the live units that withShell embedded', () => {
    expect(
      readAdsExtra({ adsMode: 'live', adUnits: { ios: UNITS, android: null } }, 'ios'),
    ).toStrictEqual({
      adsMode: 'live',
      adUnits: UNITS,
    });
  });

  it('turns ads off for a missing or unknown mode', () => {
    expect(readAdsExtra(undefined)).toStrictEqual({ adsMode: 'off', adUnits: null });
    expect(readAdsExtra({ adsMode: 'prod' })).toStrictEqual({ adsMode: 'off', adUnits: null });
  });

  it('ignores unit IDs of the wrong shape', () => {
    expect(readAdsExtra({ adsMode: 'test', adUnits: { banner: 1 } })).toStrictEqual({
      adsMode: 'test',
      adUnits: null,
    });
  });
});

// Spec 8.8: real IDs appear only in store builds, and on Android they are the game's Android ids.
describe('readAdsExtra on Android', () => {
  const both = { adsMode: 'live', adUnits: { ios: UNITS, android: ANDROID_UNITS } };

  it('reads the Android units on Android and the iOS units on iOS', () => {
    expect(readAdsExtra(both, 'android')).toStrictEqual({
      adsMode: 'live',
      adUnits: ANDROID_UNITS,
    });
    expect(readAdsExtra(both, 'ios')).toStrictEqual({ adsMode: 'live', adUnits: UNITS });
  });

  it('gives Android no units at all, never the iOS ones, while the game has no Android ids', () => {
    const iosOnly = { adsMode: 'live', adUnits: { ios: UNITS, android: null } };
    expect(readAdsExtra(iosOnly, 'android')).toStrictEqual({ adsMode: 'live', adUnits: null });
  });

  it('ignores a unit set that names no platform', () => {
    expect(readAdsExtra({ adsMode: 'live', adUnits: UNITS }, 'android')).toStrictEqual({
      adsMode: 'live',
      adUnits: null,
    });
  });
});
