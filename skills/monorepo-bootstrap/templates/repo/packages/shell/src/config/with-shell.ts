// packages/shell/src/config/with-shell.ts
// The config composer: game.config.ts + build env in, complete ExpoConfig out. Runs in Node
// (type stripping): relative imports with .ts extensions, erasable syntax, no RN imports.
// Phase 0 (monorepo-bootstrap): no ios.privacyManifests and no native-module plugin list yet. At the
// Shell's native step architecture-and-boundaries' final with-shell.ts and shell-plugins.ts replace
// this file and its test; every native setting still comes only from this file and config plugins.
import { adUnitsExtra } from './ads-config.ts';
import { resolveBuildVariant } from './app-variant.ts';
import { toGameExtra } from './game-extra.ts';

import type { BuildEnv } from './app-variant.ts';
import type { GameConfig, LanguageCode } from './game-config.ts';
import type { ExpoConfig } from 'expo/config';

const LANGUAGES: readonly LanguageCode[] = ['en', 'de', 'fa', 'ckb'];

/** Owner decision O4: every app's bundle id and Android package is io.applander.<id without hyphens>. */
function bundleIdOf(gameId: string): string {
  return `io.applander.${gameId.replaceAll('-', '')}`;
}

function localizedNames(game: GameConfig): NonNullable<ExpoConfig['locales']> {
  return Object.fromEntries(
    LANGUAGES.map((lang) => [
      lang,
      {
        ios: { CFBundleDisplayName: game.appName[lang] },
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
    infoPlist: {
      CADisableMinimumFrameDurationOnPhone: true,
      CFBundleAllowMixedLocalizations: true,
    },
  };
}

/** Pure: app.config.ts passes process.env; tests pass a plain object. */
export function withShell(game: GameConfig, env: BuildEnv): ExpoConfig {
  const bundleId = bundleIdOf(game.id);
  if (game.bundleId !== bundleId) {
    throw new Error(`bundleId ${game.bundleId} must be ${bundleId} (io.applander.<game id>)`);
  }
  const variant = resolveBuildVariant(env);
  const adsMode = game.ads.isEnabled ? variant.adsMode : 'off';
  const adUnits = adUnitsExtra(adsMode, game.ads.ids); // null unless ADS_MODE=live
  return {
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
      ['@e07/shell/plugins/with-app-variant-marker.ts', { appVariant: variant.appVariant }],
    ],
  };
}
