// packages/shell/src/services/ads/perk-offer.ts
import { canServeAds } from './ad-policy.ts';

import type { AdContext, AdPolicyConfig } from './ad-policy.ts';
import type { RewardedStatus } from './ads-port.ts';

/**
 * How a hint or a continue is offered (spec 8.5, 8.8 REWARDED, 8.10, D2, L11). 'loading' is the
 * continue's offer while its rewarded ad is still loading (S7 draws the ad key busy); 'hidden'
 * always means the perk cannot be had, so a lost run whose continue is hidden ends at once (L11).
 */
export type PerkOffer = 'free' | 'watch-ad' | 'loading' | 'hidden';

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
  /** AdsPort.rewardedStatus(), read through subscribeRewardedStatus. */
  readonly rewardedStatus: RewardedStatus;
};

function isPerkAvailable(perk: Perk): boolean {
  return perk.kind === 'hint' || (perk.isAllowedByGame && !perk.isUsedThisLevel);
}

/** A rewarded ad's offer: ready offers it, loading waits (continues only), anything else hides. */
function adOffer(perk: Perk, status: RewardedStatus): PerkOffer {
  if (status === 'ready') return 'watch-ad';
  return status === 'loading' && perk.kind === 'continue' ? 'loading' : 'hidden';
}

export function perkOffer(perk: Perk, { config, context, rewardedStatus }: PerkRequest): PerkOffer {
  if (!isPerkAvailable(perk)) return 'hidden';
  if (context.isPremium) return 'free';
  if (perk.kind === 'hint' && perk.freeHintsLeft > 0) return 'free';
  // Offline, no consent or no ad that can come: hide the offer, never show a broken one.
  return canServeAds(config, context) ? adOffer(perk, rewardedStatus) : 'hidden';
}
