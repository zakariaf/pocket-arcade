// packages/shell/src/config/with-shell.test.ts
import { ICON_CONFIG } from './art-config.ts';
import { PRIVACY_MANIFESTS } from './privacy-manifest.ts';
import { shellPlugins, TRACKING_USAGE_DESCRIPTIONS } from './shell-plugins.ts';
import { appIdOf, withShell } from './with-shell.ts';

import type { GameConfig } from './game-config.ts';

// render-art.ts has drawn 'drawn-game' only: its icon and splash join the config, no other game's.
jest.mock('./splash-grounds.ts', () => ({
  SPLASH_GROUNDS: { 'drawn-game': { light: '#A5DAF3', dark: '#1B1943' } },
}));

const MARKER = '@e07/shell/plugins/with-app-variant-marker.ts';

const LIVE_UNITS = {
  banner: 'ca-app-pub-1234567890123456/1111111111',
  interstitial: 'ca-app-pub-1234567890123456/2222222222',
  rewarded: 'ca-app-pub-1234567890123456/3333333333',
};

const GAME: GameConfig = {
  id: 'probe-game',
  appName: { en: 'Probe Game', de: 'Probe Game', fa: 'Probe Game', ckb: 'Probe Game' },
  bundleId: 'io.applander.probegame',
  appStoreId: null,
  version: '1.0.0',
  buildNumber: 3,
  premium: { productId: 'io.applander.probegame.premium', priceNote: 'EUR 1.99 (owner, O2)' },
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

/** The same game under another id, with the app ids that id must have. */
function gameWithId(id: string): GameConfig {
  const bundleId = appIdOf(id);
  return { ...GAME, id, bundleId, premium: { ...GAME.premium, productId: `${bundleId}.premium` } };
}

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

  it('writes the team, the build number, the home-screen name and the ATT text per language', () => {
    const config = withShell(
      { ...GAME, appStoreId: '1234567890' },
      { APPLE_TEAM_ID: 'ABCDE12345' },
    );
    expect(config.ios?.appleTeamId).toBe('ABCDE12345');
    expect(config.ios?.buildNumber).toBe('3');
    expect(config.locales?.['fa']).toStrictEqual({
      ios: {
        CFBundleDisplayName: 'Probe Game',
        NSUserTrackingUsageDescription: TRACKING_USAGE_DESCRIPTIONS.fa,
      },
      android: { app_name: 'Probe Game' },
    });
    for (const lang of ['en', 'de', 'fa', 'ckb'] as const) {
      expect(config.locales?.[lang]).toMatchObject({
        ios: { NSUserTrackingUsageDescription: expect.stringMatching(/\S/) },
      });
    }
    expect(config.extra?.['game']).toMatchObject({ appStoreId: '1234567890' });
  });

  it('takes only io.applander.<game id without hyphens> as the bundle id (owner decision O4)', () => {
    expect(appIdOf('line-siege')).toBe('io.applander.linesiege');
    expect(withShell(GAME, {}).ios?.bundleIdentifier).toBe('io.applander.probegame');
    expect(withShell(GAME, {}).android?.package).toBe('io.applander.probegame');
    for (const bundleId of ['com.example.probegame', 'io.applander.probe-game']) {
      expect(() => withShell({ ...GAME, bundleId }, {})).toThrow(
        `bundleId ${bundleId} must be io.applander.probegame`,
      );
    }
  });

  it("rejects the scaffold's old placeholder id com.example.linesiege for Line Siege", () => {
    const lineSiege = { ...gameWithId('line-siege'), bundleId: 'com.example.linesiege' };
    expect(() => withShell(lineSiege, {})).toThrow(
      'bundleId com.example.linesiege must be io.applander.linesiege',
    );
    expect(withShell(gameWithId('line-siege'), {}).ios?.bundleIdentifier).toBe(
      'io.applander.linesiege',
    );
  });

  it('takes only <bundle id>.premium as the Premium product id', () => {
    const premium = { ...GAME.premium, productId: 'com.example.probegame.premium' };
    expect(() => withShell({ ...GAME, premium }, {})).toThrow(
      'premium.productId com.example.probegame.premium must be io.applander.probegame.premium',
    );
  });

  it('lists the variant marker, then every Shell plugin, and embeds the privacy manifest', () => {
    const config = withShell(GAME, {});
    expect(config.plugins).toStrictEqual([
      [MARKER, { appVariant: 'test' }],
      ...shellPlugins(GAME, 'test'),
    ]);
    expect(config.ios?.privacyManifests).toBe(PRIVACY_MANIFESTS);
  });

  it('adds the icon and the splash plugin last, only for a game render-art has drawn', () => {
    expect(withShell(GAME, {}).icon).toBeUndefined();
    const drawn = withShell(gameWithId('drawn-game'), {});
    expect(drawn.icon).toBe(ICON_CONFIG.icon);
    expect(drawn.ios?.icon).toStrictEqual(ICON_CONFIG.iosIcon);
    expect(drawn.plugins?.at(-1)).toStrictEqual([
      'expo-splash-screen',
      expect.objectContaining({ backgroundColor: '#A5DAF3' }),
    ]);
  });
});
