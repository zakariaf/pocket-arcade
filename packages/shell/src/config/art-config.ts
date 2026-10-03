// packages/shell/src/config/art-config.ts
// Node world (read by app.config.ts through withShell): the icon and splash parts of the Expo
// config. The PNGs and splash-grounds.ts are written by packages/tooling/src/art/render-art.ts.
import { SPLASH_GROUNDS } from './splash-grounds.ts';

import type { ExpoConfig } from 'expo/config';

type PluginEntry = NonNullable<ExpoConfig['plugins']>[number];

/** Files written by `node packages/tooling/src/art/render-art.ts --app <id>`, relative to the app. */
const GENERATED = './assets/generated';
/** The splash logo PNG is 1024 px and represents 200 pt (the S1 logo tile with its ring). */
export const SPLASH_IMAGE_WIDTH = 200;

export type SplashColors = { readonly light: string; readonly dark: string };

/** Splash = the game's logo tile on its ground (S1), light and dark: pass PALETTE backgrounds. */
export function splashPlugin(ground: SplashColors): PluginEntry {
  return [
    'expo-splash-screen',
    {
      image: `${GENERATED}/splash-logo.png`,
      imageWidth: SPLASH_IMAGE_WIDTH,
      backgroundColor: ground.light,
      dark: { image: `${GENERATED}/splash-logo-dark.png`, backgroundColor: ground.dark },
    },
  ];
}

/** Root `icon` (Android and fallbacks) and `ios.icon` with the iOS 18+ appearances. */
export const ICON_CONFIG = {
  icon: `${GENERATED}/icon-light.png`,
  iosIcon: {
    light: `${GENERATED}/icon-light.png`,
    dark: `${GENERATED}/icon-dark.png`,
    tinted: `${GENERATED}/icon-tinted.png`,
  },
} as const satisfies {
  readonly icon: string;
  readonly iosIcon: NonNullable<ExpoConfig['ios']>['icon'];
};

/** Adds the generated icon and splash to a composed config, appending to its one plugin list. */
export function withArt(config: ExpoConfig, ground: SplashColors): ExpoConfig {
  return {
    ...config,
    icon: ICON_CONFIG.icon,
    ios: { ...config.ios, icon: ICON_CONFIG.iosIcon },
    plugins: [...(config.plugins ?? []), splashPlugin(ground)],
  };
}

/**
 * withShell's last step: `return withGameArt(config, game.id);`. A game gets its icon and splash
 * once render-art.ts has drawn it (and written its grounds to splash-grounds.ts); before that the
 * config is returned unchanged, and check-app-art reports the missing art.
 */
export function withGameArt(config: ExpoConfig, gameId: string): ExpoConfig {
  const ground = SPLASH_GROUNDS[gameId];
  return ground === undefined ? config : withArt(config, ground);
}
