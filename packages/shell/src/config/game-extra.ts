// packages/shell/src/config/game-extra.ts
// Node side: the runtime subset of GameConfig that withShell embeds as expo.extra.game.
// App code never imports game.config.ts; it reads this through read-game-extra.ts.
import type { GameConfig } from './game-config.ts';

/**
 * JSON only, and no nulls: the embedded app config turned `null` into `{}` on the device
 * (verified with SDK 57), so an absent value is an absent key.
 */
export type GameExtra = {
  readonly id: string;
  readonly appStoreId?: string;
  readonly premiumProductId: string;
  readonly adPolicy: {
    readonly isAdsEnabled: boolean;
    readonly minLevelsCompletedBeforeFirst: number;
    readonly minMsBetweenInterstitials: number;
    readonly minLevelsCompletedBetween: number;
  };
  readonly modes: GameConfig['modes'];
  readonly levels: GameConfig['levels'];
  readonly hints: GameConfig['hints'];
  readonly isContinueAllowed: boolean;
  readonly links: GameConfig['links'];
};

/** The runtime subset of a game's config; omits appStoreId until the store record exists. */
export function toGameExtra(game: GameConfig): GameExtra {
  return {
    id: game.id,
    ...(game.appStoreId === null ? {} : { appStoreId: game.appStoreId }),
    premiumProductId: game.premium.productId,
    adPolicy: { isAdsEnabled: game.ads.isEnabled, ...game.ads.policy },
    modes: game.modes,
    levels: game.levels,
    hints: game.hints,
    isContinueAllowed: game.isContinueAllowed,
    links: game.links,
  };
}
