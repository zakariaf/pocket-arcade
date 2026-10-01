// packages/shell/src/config/splash-grounds.ts
import type { SplashColors } from './art-config.ts';

/** Each drawn game's S1 ground (its palette background), light and dark, for the native splash. */
export const SPLASH_GROUNDS: Readonly<Partial<Record<string, SplashColors>>> = {
  'demo-game': { light: '#A5DAF3', dark: '#1B1943' },
};
