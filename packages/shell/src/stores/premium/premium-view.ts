// packages/shell/src/stores/premium/premium-view.ts
import type { PremiumFlow, PremiumState } from './premium-state.ts';

// One value per S12 state the screen must design and test (spec S12 "States").
export type PremiumView =
  | 'loading-price' // spinner on BUY, rest readable
  | 'store-unavailable' // "Connect to the internet to buy or restore." BUY disabled
  | 'ready' // price + BUY + Restore
  | 'purchase-in-progress' // buttons locked, spinner
  | 'pending' // "Waiting for approval - you can keep playing."
  | 'success' // thank-you animation, then 'already-owned'
  | 'error' // "The purchase couldn't be completed. You were not charged." + Try again
  | 'already-owned' // "Premium - active" + Restore
  | 'restoring' // normal page + toast premium.restoring
  | 'restore-empty' // normal page + toast premium.restore-empty
  | 'restore-failed'; // normal page + toast premium.restore-failed
// 'Cancelled by player' has no view of its own: it returns quietly to 'ready'.
// The restore outcomes are toasts over the normal page: see premium-notice.ts.

const FLOW_VIEW: Readonly<Record<PremiumFlow['kind'], PremiumView>> = {
  loading: 'loading-price',
  unavailable: 'store-unavailable',
  ready: 'ready',
  purchasing: 'purchase-in-progress',
  pending: 'pending',
  failed: 'error',
  restoring: 'restoring',
  'restore-empty': 'restore-empty',
  'restore-failed': 'restore-failed',
};

export function premiumView(state: PremiumState): PremiumView {
  if (state.isPremium) return state.didJustPurchase ? 'success' : 'already-owned';
  return FLOW_VIEW[state.flow.kind];
}
