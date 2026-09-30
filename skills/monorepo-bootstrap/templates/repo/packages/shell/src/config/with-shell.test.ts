// packages/shell/src/config/with-shell.test.ts
// Phase 0 (monorepo-bootstrap): replaced with architecture-and-boundaries' final with-shell.test.ts
// together with the composer.
import { withShell } from './with-shell.ts';

import type { GameConfig } from './game-config.ts';

const LIVE_UNITS = {
  banner: 'ca-app-pub-1234567890123456/1111111111',
  interstitial: 'ca-app-pub-1234567890123456/2222222222',
  rewarded: 'ca-app-pub-1234567890123456/3333333333',
};

const GAME: GameConfig = {
  id: 'probe-game',
  appName: { en: 'Probe Game', de: 'Probe Game', fa: 'Probe Game', ckb: 'Probe Game' },
  bundleId: 'com.example.probegame',
  appStoreId: null,
  version: '1.0.0',
  buildNumber: 3,
  premium: { productId: 'com.example.probegame.premium', priceNote: 'EUR 1.99 tier' },
  ads: {
    isEnabled: true,
    policy: {
      minLevelsCompletedBeforeFirst: 3,
      minMsBetweenInterstitials: 180_000,
      minLevelsCompletedBetween: 2,
    },
    ids: {
      ios: { appId: 'ca-app-pub-1234567890123456~1234567890', units: LIVE_UNITS },
      android: null,
    },
  },
  modes: { daily: true, endless: false },
  levels: { packCount: 3, levelsPerPack: 30 },
  hints: { freePerDay: 1 },
  isContinueAllowed: true,
  links: {
    privacyPolicy: { host: 'example.com', path: '/probe-game/privacy' },
    supportEmail: 'support@example.com',
  },
  store: { audience: 'general', ageRating: { advertising: true } },
};

const STORE_OFF = { APP_VARIANT: 'store', EXPO_PUBLIC_APP_VARIANT: 'store', ADS_MODE: 'off' };
const STORE_LIVE = { APP_VARIANT: 'store', EXPO_PUBLIC_APP_VARIANT: 'store', ADS_MODE: 'live' };

describe('withShell', () => {
  it('builds a test config with a debug URL scheme and test ads', () => {
    const config = withShell(GAME, {});
    expect(config.scheme).toBe('e07-probe-game');
    expect(config.extra).toStrictEqual({
      appVariant: 'test',
      adsMode: 'test',
      game: expect.objectContaining({ id: 'probe-game', premiumProductId: GAME.premium.productId }),
    });
  });

  it('omits the scheme, the ad units and every null in a store build without ads', () => {
    const config = withShell(GAME, STORE_OFF);
    expect(config.scheme).toBeUndefined();
    expect(config.extra?.['adUnits']).toBeUndefined();
    expect(JSON.stringify(config)).not.toContain('null');
  });

  it('embeds the live ad units only in a live store build', () => {
    expect(withShell(GAME, STORE_LIVE).extra?.['adUnits']).toStrictEqual(LIVE_UNITS);
  });

  it('refuses a live build that still carries Google sample IDs', () => {
    const sample = { ...LIVE_UNITS, banner: 'ca-app-pub-3940256099942544/2435281174' };
    const ids = { ios: { appId: GAME.ads.ids.ios.appId, units: sample }, android: null };
    const game = { ...GAME, ads: { ...GAME.ads, ids } };
    expect(() => withShell(game, STORE_LIVE)).toThrow('invalid live AdMob ids');
  });

  it('turns ads off when the game switches them off', () => {
    const game = { ...GAME, ads: { ...GAME.ads, isEnabled: false } };
    expect(withShell(game, STORE_LIVE).extra?.['adsMode']).toBe('off');
  });

  it('writes the team, the build number and the home-screen name per language', () => {
    const config = withShell(
      { ...GAME, appStoreId: '1234567890' },
      { APPLE_TEAM_ID: 'ABCDE12345' },
    );
    expect(config.ios?.appleTeamId).toBe('ABCDE12345');
    expect(config.ios?.buildNumber).toBe('3');
    expect(config.locales?.['fa']).toStrictEqual({
      ios: { CFBundleDisplayName: 'Probe Game' },
      android: { app_name: 'Probe Game' },
    });
    expect(config.extra?.['game']).toMatchObject({ appStoreId: '1234567890' });
  });

  it('rejects a bundle id that is not valid on both platforms', () => {
    expect(() => withShell({ ...GAME, bundleId: 'com.example.probe-game' }, {})).toThrow(
      'bundleId com.example.probe-game must match',
    );
  });
});
