// packages/shell/src/config/art-config.ts (fixture excerpt: the definition is not a call)
const GENERATED = './assets/generated';

/** The adaptive icon layers and the Android 12 splash icon. */
export const ANDROID_ART = {
  adaptiveIcon: { foregroundImage: `${GENERATED}/android-icon-foreground.png` },
  splash: `${GENERATED}/android-splash-icon.png`,
};

/** withShell's last step: `return withGameArt(config, game.id);`. */
export function withGameArt<T>(config: T, gameId: string): T {
  return gameId === '' ? config : config;
}
