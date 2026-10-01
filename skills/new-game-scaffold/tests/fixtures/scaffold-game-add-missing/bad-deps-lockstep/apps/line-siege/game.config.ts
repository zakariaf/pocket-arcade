// apps/line-siege/game.config.ts
import type { GameConfig } from '@e07/shell/config/game-config.ts';

/** The Latin-script name; every language shows it unless it has its own (native review later). */
const LATIN_NAME = 'Line Siege';

/**
 * Spec section 11: every per-game value lives here. Read by app.config.ts only.
 * - modes.endless is true exactly when the levels spec has endless { kind: 'endless' } (check-levels
 *   rule endless-mode); modes.daily is true exactly when it has a daily.
 * - hints.freePerDay is 0 for a game without a solver hint; isContinueAllowed is true exactly
 *   when rules.continueRun is { kind: 'once' }.
 * - store.ageRating is the owner's App Store answer set (step G1): violenceCartoonOrFantasy is
 *   NONE unless the game hits monsters or characters.
 */
export const gameConfig: GameConfig = {
  id: 'line-siege',
  appName: { en: LATIN_NAME, de: LATIN_NAME, fa: LATIN_NAME, ckb: LATIN_NAME },
  bundleId: 'io.applander.linesiege',
  appStoreId: null,
  version: '1.0.0',
  buildNumber: 1,
  premium: {
    productId: 'io.applander.linesiege.premium',
    priceNote: 'EUR 1.99 price point (owner decision)',
  },
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
  modes: { daily: true, endless: true },
  levels: { packCount: 3, levelsPerPack: 30 },
  hints: { freePerDay: 0 },
  isContinueAllowed: true,
  links: {
    privacyPolicy: { host: 'example.com', path: '/line-siege/privacy' },
    supportEmail: 'support@example.com',
  },
  store: {
    audience: 'general',
    ageRating: {
      advertising: true,
      violenceCartoonOrFantasy: 'INFREQUENT_OR_MILD',
      gambling: false,
    },
  },
};
