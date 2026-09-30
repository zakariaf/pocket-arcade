// packages/shell/src/services/ads/read-ads-extra.test.ts
import { readAdsExtra } from './read-ads-extra.ts';

const UNITS = {
  banner: 'ca-app-pub-1234567890123456/1111111111',
  interstitial: 'ca-app-pub-1234567890123456/2222222222',
  rewarded: 'ca-app-pub-1234567890123456/3333333333',
};

describe('readAdsExtra', () => {
  it('reads the mode and the live units that withShell embedded', () => {
    expect(readAdsExtra({ adsMode: 'live', adUnits: UNITS })).toStrictEqual({
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
