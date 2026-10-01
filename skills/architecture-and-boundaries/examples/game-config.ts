// apps/line-siege/game.config.ts
import type { GameConfig } from '@e07/shell/config/game-config.ts';

/** Spec section 11: every per-game value lives here. Read by app.config.ts only. */
export const gameConfig: GameConfig = {
  id: 'line-siege',
  appName: { en: 'Line Siege', de: 'Line Siege', fa: 'محاصره خط', ckb: 'گەمارۆی هێڵ' },
  // Owner decision O4: io.applander.<game id without hyphens>; withShell refuses anything else.
  bundleId: 'io.applander.linesiege',
  appStoreId: null,
  version: '1.0.0',
  buildNumber: 1,
  premium: { productId: 'io.applander.linesiege.premium', priceNote: 'EUR 1.99 (owner, O2)' },
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
