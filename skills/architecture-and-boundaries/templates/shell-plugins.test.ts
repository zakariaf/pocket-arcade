// packages/shell/src/config/shell-plugins.test.ts
import { GOOGLE_SAMPLE_APP_IDS } from './ads-config.ts';
import { AUDIO_API_PLUGIN } from './audio-config.ts';
import { FONT_FILES, shellPlugins, SUPPORTED_LOCALES } from './shell-plugins.ts';

import type { GameConfig } from './game-config.ts';
import type { PluginEntry } from './shell-plugins.ts';

const GAME: GameConfig = {
  id: 'probe-game',
  appName: { en: 'Probe Game', de: 'Probe Game', fa: 'Probe Game', ckb: 'Probe Game' },
  bundleId: 'com.example.probegame',
  appStoreId: null,
  version: '1.0.0',
  buildNumber: 1,
  premium: { productId: 'com.example.probegame.premium', priceNote: 'EUR 1.99 tier' },
  ads: {
    isEnabled: true,
    policy: {
      minLevelsCompletedBeforeFirst: 3,
      minMsBetweenInterstitials: 180_000,
      minLevelsCompletedBetween: 2,
    },
    ids: {
      ios: {
        appId: 'ca-app-pub-1234567890123456~1234567890',
        units: {
          banner: 'ca-app-pub-1234567890123456/1111111111',
          interstitial: 'ca-app-pub-1234567890123456/2222222222',
          rewarded: 'ca-app-pub-1234567890123456/3333333333',
        },
      },
      android: null,
    },
  },
  modes: { daily: true, endless: false },
  levels: { packCount: 3, levelsPerPack: 30 },
  hints: { freePerDay: 0 },
  isContinueAllowed: true,
  links: {
    privacyPolicy: { host: 'example.com', path: '/probe-game/privacy' },
    supportEmail: 'support@example.com',
  },
  store: { audience: 'general', ageRating: { advertising: true } },
};

function entryNamed(plugins: readonly PluginEntry[], name: string): unknown {
  const entry = plugins.find((item) => (Array.isArray(item) ? item[0] : item) === name);
  return Array.isArray(entry) ? entry[1] : entry;
}

describe('shellPlugins', () => {
  it('lists every native module of the Shell exactly once', () => {
    const names = shellPlugins(GAME, 'test').map((item) => (Array.isArray(item) ? item[0] : item));
    expect(names).toStrictEqual([
      'expo-sqlite',
      'expo-localization',
      'expo-font',
      'expo-iap',
      'react-native-google-mobile-ads',
      'react-native-audio-api',
    ]);
  });

  it('gives expo-localization only the four languages and expo-font the five Toybox faces', () => {
    const plugins = shellPlugins(GAME, 'test');
    const locales = [...SUPPORTED_LOCALES];
    expect(entryNamed(plugins, 'expo-localization')).toStrictEqual({
      supportedLocales: { ios: locales, android: locales },
    });
    expect(entryNamed(plugins, 'expo-font')).toStrictEqual({ fonts: [...FONT_FILES] });
    expect(FONT_FILES).toHaveLength(5);
  });

  it('adds expo-iap and expo-sqlite without options, and the audio plugin as audio-config says', () => {
    const plugins = shellPlugins(GAME, 'test');
    expect(plugins).toContain('expo-iap');
    expect(plugins).toContain('expo-sqlite');
    expect(plugins).toContain(AUDIO_API_PLUGIN);
  });

  it('passes Google sample app ids in test builds and the game ids in live builds', () => {
    const inTest = entryNamed(shellPlugins(GAME, 'test'), 'react-native-google-mobile-ads');
    const inLive = entryNamed(shellPlugins(GAME, 'live'), 'react-native-google-mobile-ads');
    expect(inTest).toMatchObject({ iosAppId: GOOGLE_SAMPLE_APP_IDS.ios });
    expect(inLive).toMatchObject({ iosAppId: GAME.ads.ids.ios.appId });
  });
});
