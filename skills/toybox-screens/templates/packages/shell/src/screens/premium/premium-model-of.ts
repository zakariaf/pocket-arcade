// packages/shell/src/screens/premium/premium-model-of.ts
// Pure: the PremiumModel S12 draws, from the premium store's state and the Premium service. Buy,
// Try again and Restore run the service (it dispatches every step); failures go to its onError.
import { restorePremium } from '@e07/shell/services/purchase/premium-service.ts';
import { buyPremium } from '@e07/shell/services/purchase/premium-store-flow.ts';
import { priceOf } from '@e07/shell/stores/premium/premium-state.ts';
import { premiumView } from '@e07/shell/stores/premium/premium-view.ts';

import type { PremiumModel } from './premium-model.ts';
import type { PremiumServiceDeps } from '@e07/shell/services/purchase/premium-service.ts';
import type { PremiumState } from '@e07/shell/stores/premium/premium-state.ts';

export type PremiumModelInput = {
  readonly state: PremiumState;
  readonly service: PremiumServiceDeps;
  /** Already translated (gameMessageText). */
  readonly gameName: string;
  readonly isReducedMotion: boolean;
  /** The saved Reduce motion choice (useReduceMotionSetting): it hides the success confetti. */
  readonly isConfettiHidden: boolean;
  readonly onBack: () => void;
};

export function premiumModelOf(input: PremiumModelInput): PremiumModel {
  const { state, service } = input;
  // Handlers stay synchronous: the promise ends in the service's own error sink.
  const handleBuy = (): void => {
    buyPremium(service).catch(service.onError);
  };
  const handleRestore = (): void => {
    restorePremium(service).catch(service.onError);
  };
  return {
    view: premiumView(state),
    hasJustRestored: state.didJustRestore,
    isRestoreToastStack: false,
    priceText: priceOf(state.flow),
    gameName: input.gameName,
    isReducedMotion: input.isReducedMotion,
    isConfettiHidden: input.isConfettiHidden,
    onBack: input.onBack,
    onBuy: handleBuy,
    onRestore: handleRestore,
    // "Try again" after an error is a new purchase request.
    onTryAgain: handleBuy,
  };
}
