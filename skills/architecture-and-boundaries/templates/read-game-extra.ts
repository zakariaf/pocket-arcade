// packages/shell/src/app/read-game-extra.ts
import Constants from 'expo-constants';
import * as v from 'valibot';

import type { GameExtra } from '@e07/shell/config/game-extra.ts';

const COUNT = v.pipe(v.number(), v.safeInteger(), v.minValue(0));

const GAME_EXTRA = v.object({
  id: v.string(),
  appStoreId: v.exactOptional(v.string()),
  premiumProductId: v.string(),
  adPolicy: v.object({
    isAdsEnabled: v.boolean(),
    minLevelsCompletedBeforeFirst: COUNT,
    minMsBetweenInterstitials: COUNT,
    minLevelsCompletedBetween: COUNT,
  }),
  modes: v.object({ daily: v.boolean(), endless: v.boolean() }),
  levels: v.object({ packCount: COUNT, levelsPerPack: COUNT }),
  hints: v.object({ freePerDay: COUNT }),
  isContinueAllowed: v.boolean(),
  links: v.object({
    privacyPolicy: v.object({ host: v.string(), path: v.string() }),
    supportEmail: v.string(),
  }),
});

/** The runtime game config embedded by withShell (expo.extra.game). A mismatch is a build bug. */
export function readGameExtra(extra: unknown = Constants.expoConfig?.extra): GameExtra {
  const game: unknown =
    typeof extra === 'object' && extra !== null ? Reflect.get(extra, 'game') : undefined;
  return v.parse(GAME_EXTRA, game);
}

/** Marketing version for the save rows and About (S11b). */
export function readAppVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}
