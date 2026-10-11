// packages/shell/src/stores/premium/premium-reducer.ts
import { priceOf } from './premium-state.ts';
import {
  onEntitlementsChecked,
  onGranted,
  onPriceLoaded,
  onPurchaseFailed,
  onRestoreFinished,
  onRestoreTapped,
} from './premium-transitions.ts';

import type { PremiumAction, PremiumState } from './premium-state.ts';

const CAN_BUY = new Set(['ready', 'failed', 'restore-empty', 'restore-failed']);

/**
 * BUY may start a purchase (spec S12): not Premium, a price from the store, and a page that sells
 * (never while loading, buying, waiting for approval or restoring). The reducer refuses every
 * other buy-tapped, and the S12 Buy key reads the same rule, so no tap ever reaches the store port
 * for a purchase the flow would not track.
 */
export function canBuyPremium(state: PremiumState): boolean {
  return !state.isPremium && priceOf(state.flow) !== null && CAN_BUY.has(state.flow.kind);
}

function onBuyTapped(state: PremiumState): PremiumState {
  const price = priceOf(state.flow);
  if (price === null || !canBuyPremium(state)) return state;
  return { ...state, flow: { kind: 'purchasing', price } };
}

export function premiumReducer(state: PremiumState, action: PremiumAction): PremiumState {
  switch (action.type) {
    case 'connect-started':
      return { ...state, flow: { kind: 'loading' } };
    case 'store-unavailable':
      return { ...state, flow: { kind: 'unavailable' } };
    case 'price-loaded':
      return onPriceLoaded(state, action.price);
    case 'buy-tapped':
      return onBuyTapped(state);
    case 'purchase-failed':
      return onPurchaseFailed(state, action.failure);
    case 'purchase-pending':
      return state.flow.kind === 'purchasing'
        ? { ...state, flow: { ...state.flow, kind: 'pending' } }
        : state;
    case 'premium-granted':
      return onGranted(state);
    case 'restore-tapped':
      return onRestoreTapped(state);
    case 'restore-finished':
      return onRestoreFinished(state, action.evidence);
    case 'entitlements-checked':
      return onEntitlementsChecked(state, action.evidence);
    case 'thanks-shown':
      return { ...state, didJustPurchase: false };
    case 'restore-notice-shown':
      return { ...state, didJustRestore: false };
    case 'debug-premium-set':
      return {
        ...state,
        isPremium: action.isPremium,
        didJustPurchase: false,
        didJustRestore: false,
      };
  }
}
