// packages/shell/src/screens/premium/premium-model.ts
// What S12 Premium draws. use-premium-model.ts builds it from the premium store: premiumView()
// gives one value per S12 state; "cancelled" has no view (the page quietly returns to 'ready').
import type { PremiumView } from '@e07/shell/stores/premium/premium-view.ts';

export type PremiumModel = {
  readonly view: PremiumView;
  /** A restore just found the purchase: the "Purchase restored" toast (then 'already-owned'). */
  readonly hasJustRestored: boolean;
  /** The design's restore card (parity frame only): all four restore outcomes stacked at once. */
  readonly isRestoreToastStack: boolean;
  /** Exactly the store's string ("€1.99", "1,99 €"); never typed into the code. */
  readonly priceText: string | null;
  readonly gameName: string;
  readonly isReducedMotion: boolean;
  readonly onBack: () => void;
  readonly onBuy: () => void;
  readonly onRestore: () => void;
  readonly onTryAgain: () => void;
};
