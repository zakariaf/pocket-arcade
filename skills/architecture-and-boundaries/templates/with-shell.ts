// packages/shell/src/config/with-shell.ts
// The config composer: game.config.ts + build env in, complete ExpoConfig out. Runs in Node
// (type stripping): relative imports with .ts extensions, erasable syntax, no RN imports.
// Every native setting comes only from this file and config plugins. This full version replaces the
// bootstrap's phase-0 composer once every native module is installed (architecture-and-boundaries):
// it adds the privacy manifest, the one plugin list (shell-plugins.ts) and the game's art. The swap
// (this file and with-shell.test.ts, Shell step 8) is committed with the trailer line
// Spec-Change: with-shell final composer (phase 0 placeholder replaced)
// The app ids are the owner's decision O4 (2026-09-30): io.applander.<game id without hyphens>
// for the iOS bundle and the Android package, and <bundle id>.premium for Premium.
import { adUnitsExtra } from './ads-config.ts';
import { resolveBuildVariant } from './app-variant.ts';
import { withGameArt } from './art-config.ts';
import { toGameExtra } from './game-extra.ts';
import { PRIVACY_MANIFESTS } from './privacy-manifest.ts';
import { shellPlugins, TRACKING_USAGE_DESCRIPTIONS } from './shell-plugins.ts';

import type { BuildEnv } from './app-variant.ts';
import type { GameConfig, LanguageCode } from './game-config.ts';
import type { ExpoConfig } from 'expo/config';

const LANGUAGES: readonly LanguageCode[] = ['en', 'de', 'fa', 'ckb'];

/** The one app id of a game: io.applander.<game id without hyphens>, all lowercase (O4). */
export function appIdOf(gameId: string): string {
  return `io.applander.${gameId.replaceAll('-', '')}`.toLowerCase();
}

/** Refuses any other bundle id (com.example.* and other placeholders) or Premium product id. */
function assertAppIds(game: GameConfig): void {
  const appId = appIdOf(game.id);
  if (game.bundleId !== appId) {
    throw new Error(`bundleId ${game.bundleId} must be ${appId} (io.applander.<game id>)`);
  }
  if (game.premium.productId !== `${appId}.premium`) {
    throw new Error(`premium.productId ${game.premium.productId} must be ${appId}.premium`);
  }
}

function localizedNames(game: GameConfig): NonNullable<ExpoConfig['locales']> {
  return Object.fromEntries(
    LANGUAGES.map((lang) => [
      lang,
      {
        ios: {
          CFBundleDisplayName: game.appName[lang],
          // admob-ads: Apple's tracking prompt text, localised (InfoPlist.strings at prebuild).
          NSUserTrackingUsageDescription: TRACKING_USAGE_DESCRIPTIONS[lang],
        },
        android: { app_name: game.appName[lang] },
      },
    ]),
  );
}

function iosConfig(game: GameConfig, teamId: string | undefined): NonNullable<ExpoConfig['ios']> {
  return {
    bundleIdentifier: game.bundleId,
    buildNumber: String(game.buildNumber),
    deploymentTarget: '16.4',
    supportsTablet: true,
    ...(teamId === undefined ? {} : { appleTeamId: teamId }),
    config: { usesNonExemptEncryption: false },
    // privacy-and-network-audit: the aggregated required-reason APIs of every pod.
    privacyManifests: PRIVACY_MANIFESTS,
    infoPlist: {
      CADisableMinimumFrameDurationOnPhone: true,
      CFBundleAllowMixedLocalizations: true,
    },
  };
}

/** Pure: app.config.ts passes process.env; tests pass a plain object. */
export function withShell(game: GameConfig, env: BuildEnv): ExpoConfig {
  assertAppIds(game);
  const variant = resolveBuildVariant(env);
  const adsMode = game.ads.isEnabled ? variant.adsMode : 'off';
  const adUnits = adUnitsExtra(adsMode, game.ads.ids); // null unless ADS_MODE=live
  const config: ExpoConfig = {
    name: game.appName.en,
    slug: game.id,
    version: game.version,
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    ...(variant.appVariant === 'test' ? { scheme: `e07-${game.id}` } : {}),
    ios: iosConfig(game, env['APPLE_TEAM_ID']),
    android: { package: game.bundleId, versionCode: game.buildNumber },
    locales: localizedNames(game),
    updates: { enabled: false },
    experiments: { reactCompiler: true },
    extra: {
      appVariant: variant.appVariant,
      adsMode,
      ...(adUnits === null ? {} : { adUnits }), // omit, never null
      game: toGameExtra(game),
    },
    plugins: [
      // architecture-and-boundaries: the build variant marker (test or store).
      ['@e07/shell/plugins/with-app-variant-marker.ts', { appVariant: variant.appVariant }],
      // One line per native module, each naming its skill (shell-plugins.ts).
      ...shellPlugins(game, adsMode),
    ],
  };
  // code-drawn-art-and-icons: the icon and splash, once render-art.ts has drawn this game.
  return withGameArt(config, game.id);
}
