// packages/shell/src/screens/game/use-perk-payment.ts
// Paying for a hint or a continue BEFORE the host is sent it (spec 8.5, 8.8, 8.10, D2): the ads
// layer's perkOffer decides free / watch-ad / loading / hidden from the rewarded ad's status
// (AdsPort.rewardedStatus, followed live through subscribeRewardedStatus); 'loading' is only ever a
// continue's offer (S7 draws the ad key busy), and 'hidden' always means it cannot be had (L11);
// the hint perk is the ads layer's useHintPerk(today), whose free hints follow game.config.ts
// hints.freePerDay (1 with solver hints, 0 without); a free hint for a non-Premium player spends
// that daily allowance; a watched ad counts only when the reward was earned. One payment runs at a
// time: a second tap before the first settles pays nothing and sends nothing. While a continue is
// paid for with an ad, its offer reads 'loading' (S7's ad key busy under the ad), never 'hidden':
// the shown ad is used up, yet the loss is not stranded (L11), it waits for the payment.
import { useRef, useState, useSyncExternalStore } from 'react';

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
import type { ErrorLogPort } from '@e07/shell/services/error-log/error-log-port.ts';

export type PerkPayment = {
  readonly hintOffer: PerkOffer;
  readonly continueOffer: PerkOffer;
  /** Resolves true once the hint is paid for (allowance spent, Premium, or the ad rewarded). */
  readonly payForHint: () => Promise<boolean>;
  readonly payForContinue: () => Promise<boolean>;
};

/**
 * Sends a perk to the run only once its payment resolved true (a hint from the top bar, a continue
 * from S7); a failed payment is recorded as an 'ads' error, never shown (ads are silent).
 */
export function sendWhenPaid(
  pay: () => Promise<boolean>,
  send: () => void,
  errorLog: ErrorLogPort,
): void {
  pay()
    .then((isPaid) => {
      if (isPaid) send();
    })
    .catch((error: unknown) => {
      errorLog.record('ads', error);
    });
}

type Perk = 'hint' | 'continue';

type OnePayment = {
  /** The perk being paid for, as React state (null when no payment is in flight). */
  readonly inFlight: Perk | null;
  readonly run: (perk: Perk, payment: () => Promise<boolean>) => Promise<boolean>;
};

/**
 * A double tap reaches the handlers before the screen re-renders, so both see the same offer: the
 * first payment runs, and any other started before it settles resolves false at once (the ref);
 * the screen follows the payment through inFlight.
 */
function useOnePaymentAtATime(): OnePayment {
  const isPaying = useRef(false);
  const [inFlight, setInFlight] = useState<Perk | null>(null);
  return {
    inFlight,
    run: async (perk, payment) => {
      if (isPaying.current) return false;
      isPaying.current = true;
      setInFlight(perk);
      try {
        return await payment();
      } finally {
        isPaying.current = false;
        setInFlight(null);
      }
    },
  };
}

/** The continue perk of a run: offered by the game only while the run's continue is open. */
function continuePerkOf(view: SessionView | null) {
  const isOffered = view?.continueState === 'offered';
  return { kind: 'continue', isAllowedByGame: isOffered, isUsedThisLevel: false } as const;
}

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
  const payment = useOnePaymentAtATime();
  const offer = perkOffer(continuePerkOf(view), request);
  // A continue paid with an ad reads 'loading' until the payment settles (Premium's stays 'free').
  const isPayingWithAd = payment.inFlight === 'continue' && offer !== 'free';
  const continueOffer = isPayingWithAd ? 'loading' : offer;
  // 'loading' and 'hidden' pay nothing: the busy key takes no press, and a hidden one is not drawn.
  const pay = async (offer: PerkOffer): Promise<boolean> => {
    if (offer === 'free') return true;
    return offer === 'watch-ad' ? earnRewardedPerk({ ads, lifecycle }) : false;
  };
  return {
    hintOffer,
    continueOffer,
    payForHint: () =>
      payment.run('hint', () => {
        if (hintOffer === 'free' && !request.context.isPremium) {
          dispatch({ type: 'use-free-hint', today, freePerDay });
        }
        return pay(hintOffer);
      }),
    payForContinue: () => payment.run('continue', () => pay(offer)),
  };
}
