// packages/shell/src/testing/test-game-extra.ts
// Jest only: what withShell embeds as expo.extra for the pilot game (Line Siege: 3 packs of 30
// levels, daily and endless, ads on), for model-hook tests that read the game config, the app
// version or the build number. Use it as the expo-constants mock:
//   jest.mock('expo-constants', () =>
//     jest.requireActual<Record<string, unknown>>('@e07/shell/testing/test-game-extra.ts')[
//       'TEST_EXPO_CONSTANTS'
//     ],
//   );
import type { GameExtra } from '@e07/shell/config/game-extra.ts';

export const TEST_GAME_EXTRA: GameExtra = {
  id: 'line-siege',
  premiumProductId: 'com.example.linesiege.premium',
  adPolicy: {
    isAdsEnabled: true,
    minLevelsCompletedBeforeFirst: 3,
    minMsBetweenInterstitials: 180_000,
    minLevelsCompletedBetween: 2,
  },
  modes: { daily: true, endless: true },
  levels: { packCount: 3, levelsPerPack: 30 },
  hints: { freePerDay: 0 },
  isContinueAllowed: true,
  links: {
    privacyPolicy: { host: 'example.com', path: '/line-siege/privacy' },
    supportEmail: 'support@example.com',
  },
};

/**
 * expo-constants as a test build sees it: version 1.0.0, build 8, test ads. Tests reach it through
 * jest.requireActual, which knip cannot follow.
 * @public
 */
export const TEST_EXPO_CONSTANTS = {
  __esModule: true,
  default: {
    expoConfig: {
      name: 'Line Siege',
      version: '1.0.0',
      ios: { buildNumber: '8' },
      extra: { adsMode: 'test', game: TEST_GAME_EXTRA },
    },
  },
};

/**
 * The same build config for a game that differs (the tally test game has solver hints, so one
 * free hint a day): `testExpoConstantsWith({ hints: { freePerDay: 1 } })` as the expo-constants
 * mock. Tests reach it through jest.requireActual, which knip cannot follow.
 * @public
 */
export function testExpoConstantsWith(game: Partial<GameExtra>): typeof TEST_EXPO_CONSTANTS {
  const { expoConfig } = TEST_EXPO_CONSTANTS.default;
  return {
    __esModule: true,
    default: {
      expoConfig: {
        ...expoConfig,
        extra: { ...expoConfig.extra, game: { ...TEST_GAME_EXTRA, ...game } },
      },
    },
  };
}
