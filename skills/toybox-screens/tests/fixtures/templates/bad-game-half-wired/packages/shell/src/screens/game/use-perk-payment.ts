// packages/shell/src/screens/game/use-perk-payment.ts (planted: hints and continues are never paid for)
import type { SessionView } from '@e07/shell/game-host/session-view.ts';
import type { PerkOffer } from '@e07/shell/services/ads/perk-offer.ts';

export type PerkPayment = {
  readonly hintOffer: PerkOffer;
  readonly continueOffer: PerkOffer;
  readonly payForHint: () => Promise<boolean>;
  readonly payForContinue: () => Promise<boolean>;
};

export function usePerkPayment(view: SessionView | null): PerkPayment {
  const offer: PerkOffer = view === null ? 'hidden' : 'free';
  return {
    hintOffer: offer,
    continueOffer: offer,
    payForHint: () => Promise.resolve(true),
    payForContinue: () => Promise.resolve(true),
  };
}
