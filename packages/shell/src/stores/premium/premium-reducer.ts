// packages/shell/src/stores/premium/premium-reducer.ts
import { priceOf } from './premium-state.ts';
import {
  onEntitlementsChecked,
  onGranted,
  onPurchaseFailed,
  onRestoreFinished,
} from './premium-transitions.ts';

import type { PremiumAction, PremiumState } from './premium-state.ts';

const CAN_BUY = new Set(['ready', 'failed', 'restore-empty', 'restore-failed']);

function onBuyTapped(state: PremiumState): PremiumState {
  const price = priceOf(state.flow);
  if (state.isPremium || price === null || !CAN_BUY.has(state.flow.kind)) return state;
  return { ...state, flow: { kind: 'purchasing', price } };
}

export function premiumReducer(state: PremiumState, action: PremiumAction): PremiumState {
  switch (action.type) {
    case 'connect-started':
      return { ...state, flow: { kind: 'loading' } };
    case 'store-unavailable':
      return { ...state, flow: { kind: 'unavailable' } };
    case 'price-loaded':
      return state.flow.kind === 'loading'
        ? { ...state, flow: { kind: 'ready', price: action.price } }
        : state;
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
      return { ...state, flow: { kind: 'restoring', price: priceOf(state.flow) } };
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
