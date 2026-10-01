// packages/shell/src/config/shell-plugins.ts
// Node world (read by app.config.ts through withShell): the ONE native-module plugin list of every
// Pocket Arcade app. Each entry names the skill that owns the module; a new native module with a
// config plugin gets its line here (never a second list, never an edit in ios/). Paths in plugin
// options are relative to the app folder (Expo's project root).
import ckb from '@e07/shell/i18n/catalogs/ckb.json' with { type: 'json' };
import de from '@e07/shell/i18n/catalogs/de.json' with { type: 'json' };
import en from '@e07/shell/i18n/catalogs/en.json' with { type: 'json' };
import fa from '@e07/shell/i18n/catalogs/fa.json' with { type: 'json' };

import { admobPluginOptions } from './ads-config.ts';
import { AUDIO_API_PLUGIN } from './audio-config.ts';
import { SKADNETWORK_IDS } from './skadnetwork-ids.ts';

import type { AdsMode } from './app-variant.ts';
import type { GameConfig, LanguageCode } from './game-config.ts';
import type { ExpoConfig } from 'expo/config';

export type PluginEntry = NonNullable<ExpoConfig['plugins']>[number];

/** The four app languages, so iOS lists them in Settings > App > Language. */
export const SUPPORTED_LOCALES: readonly LanguageCode[] = ['en', 'de', 'fa', 'ckb'];

const TRACKING_KEY = 'consent.tracking.usage-description';

/**
 * Apple's App Tracking Transparency prompt text (NSUserTrackingUsageDescription) in each app
 * language, from the Shell catalogs: the plugin gets the en text, withShell's locales all four.
 */
export const TRACKING_USAGE_DESCRIPTIONS: Readonly<Record<LanguageCode, string>> = {
  en: en[TRACKING_KEY],
  de: de[TRACKING_KEY],
  fa: fa[TRACKING_KEY],
  ckb: ckb[TRACKING_KEY],
};

/** The five Toybox faces (toybox-design-system); family name = file name = PostScript name. */
export const FONT_FILES: readonly string[] = [
  './assets/fonts/LilitaOne.ttf',
  './assets/fonts/Rubik-Regular.ttf',
  './assets/fonts/Rubik-Bold.ttf',
  './assets/fonts/Vazirmatn-Regular.ttf',
  './assets/fonts/Vazirmatn-Bold.ttf',
];

/**
 * Every native module's config plugin, in one place. Each package must be installed in the app
 * (npx expo install, dependency-management) before its line can resolve: this list is complete
 * once the Shell's native step has installed them all (Shell build order, before the first
 * simulator build).
 */
export function shellPlugins(game: GameConfig, adsMode: AdsMode): PluginEntry[] {
  const locales = [...SUPPORTED_LOCALES];
  return [
    // save-persistence-and-migrations: the synchronous save database (save.db).
    'expo-sqlite',
    // i18n-strings-and-catalogs: only supportedLocales (no per-language plist strings here).
    ['expo-localization', { supportedLocales: { ios: locales, android: locales } }],
    // toybox-design-system: the five Toybox fonts embedded at build time.
    ['expo-font', { fonts: [...FONT_FILES] }],
    // premium-purchase: StoreKit 2 for the one Premium purchase (no options).
    'expo-iap',
    // admob-ads: app IDs and SKAdNetwork IDs, through admobPluginOptions only.
    ['react-native-google-mobile-ads', admobPluginOptions(adsMode, game.ads.ids, SKADNETWORK_IDS)],
    // admob-ads: Apple's App Tracking Transparency prompt (guideline 5.1.2(i)), asked after Google's
    // form; withShell's locales carry the text in all four languages.
    ['expo-tracking-transparency', { userTrackingPermission: TRACKING_USAGE_DESCRIPTIONS.en }],
    // game-audio-and-haptics: no background audio, microphone, permissions or downloads.
    AUDIO_API_PLUGIN,
  ];
}
