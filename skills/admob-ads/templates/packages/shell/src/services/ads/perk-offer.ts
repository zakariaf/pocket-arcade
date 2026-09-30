// packages/shell/src/services/ads/perk-offer.ts
import { canServeAds } from './ad-policy.ts';

import type { AdContext, AdPolicyConfig } from './ad-policy.ts';

// How a hint or a continue is offered (spec 8.5, 8.8 REWARDED, 8.10, D2).
export type PerkOffer = 'free' | 'watch-ad' | 'hidden';

/**
 * freeHintsLeft: selectFreeHintsLeft(progress, today, extra.hints.freePerDay), as useHintPerk
 * (app/use-ad-context.ts) reads it; a game whose config gives 0 free hints never offers a free one.
 */
export type HintPerk = { readonly kind: 'hint'; readonly freeHintsLeft: number };

export type Perk =
  | HintPerk
  | {
      readonly kind: 'continue';
      readonly isAllowedByGame: boolean;
      readonly isUsedThisLevel: boolean;
    };

export type PerkRequest = {
  readonly config: AdPolicyConfig;
  readonly context: AdContext;
  readonly isRewardedLoaded: boolean;
};

function isPerkAvailable(perk: Perk): boolean {
  return perk.kind === 'hint' || (perk.isAllowedByGame && !perk.isUsedThisLevel);
}

export function perkOffer(
  perk: Perk,
  { config, context, isRewardedLoaded }: PerkRequest,
): PerkOffer {
  if (!isPerkAvailable(perk)) return 'hidden';
  if (context.isPremium) return 'free';
  if (perk.kind === 'hint' && perk.freeHintsLeft > 0) return 'free';
  // Offline, no consent or nothing loaded: hide the button, never show a broken one.
  return canServeAds(config, context) && isRewardedLoaded ? 'watch-ad' : 'hidden';
}
