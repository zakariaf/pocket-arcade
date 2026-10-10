// packages/shell/src/screens/game/use-perk-payment.ts
// Paying for a hint or a continue BEFORE the host is sent it (spec 8.5, 8.8, 8.10, D2): the ads
// layer's perkOffer decides free / watch-ad / loading / hidden from the rewarded ad's status
// (AdsPort.rewardedStatus, followed live through subscribeRewardedStatus); 'loading' is only ever a
// continue's offer (S7 draws the ad key busy), and 'hidden' always means it cannot be had (L11);
// the hint perk is the ads layer's useHintPerk(today), whose free hints follow game.config.ts
// hints.freePerDay (1 with solver hints, 0 without); a free hint for a non-Premium player spends
// that daily allowance; a watched ad counts only when the reward was earned.
import { useSyncExternalStore } from 'react';

import { useServices } from '@e07/shell/app/services-context.tsx';
import { useAdContext, useAdPolicyConfig, useHintPerk } from '@e07/shell/app/use-ad-context.ts';
import { useGameExtra } from '@e07/shell/app/use-game-extra.ts';
import { useToday } from '@e07/shell/app/use-today.ts';
import { useGameHost } from '@e07/shell/game-host/game-host-context.tsx';
import { earnRewardedPerk } from '@e07/shell/services/ads/ad-moments.ts';
import { perkOffer } from '@e07/shell/services/ads/perk-offer.ts';
import { selectProgressDispatch } from '@e07/shell/stores/progress-selectors.ts';
import { useProgressStore } from '@e07/shell/stores/progress-store.ts';

import type { SessionView } from '@e07/shell/game-host/session-view.ts';
import type { PerkOffer } from '@e07/shell/services/ads/perk-offer.ts';

export type PerkPayment = {
  readonly hintOffer: PerkOffer;
  readonly continueOffer: PerkOffer;
  /** Resolves true once the hint is paid for (allowance spent, Premium, or the ad rewarded). */
  readonly payForHint: () => Promise<boolean>;
  readonly payForContinue: () => Promise<boolean>;
};

export function usePerkPayment(view: SessionView | null): PerkPayment {
  const { ads } = useServices();
  const { lifecycle } = useGameHost();
  const today = useToday();
  const request = {
    config: useAdPolicyConfig('result'),
    context: useAdContext('result'),
    rewardedStatus: useSyncExternalStore(ads.subscribeRewardedStatus, ads.rewardedStatus),
  };
  const { freePerDay } = useGameExtra().hints;
  const dispatch = useProgressStore(selectProgressDispatch);
  const hintOffer = perkOffer(useHintPerk(today), request);
  const isOffered = view?.continueState === 'offered';
  const continuePerk = {
    kind: 'continue',
    isAllowedByGame: isOffered,
    isUsedThisLevel: false,
  } as const;
  const continueOffer = perkOffer(continuePerk, request);
  // 'loading' and 'hidden' pay nothing: the busy key takes no press, and a hidden one is not drawn.
  const pay = async (offer: PerkOffer): Promise<boolean> => {
    if (offer === 'free') return true;
    return offer === 'watch-ad' ? earnRewardedPerk({ ads, lifecycle }) : false;
  };
  return {
    hintOffer,
    continueOffer,
    payForHint: () => {
      if (hintOffer === 'free' && !request.context.isPremium) {
        dispatch({ type: 'use-free-hint', today, freePerDay });
      }
      return pay(hintOffer);
    },
    payForContinue: () => pay(continueOffer),
  };
}
