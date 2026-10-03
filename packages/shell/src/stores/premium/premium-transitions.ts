// packages/shell/src/stores/premium/premium-transitions.ts
import { priceOf, readyOrUnavailable } from './premium-state.ts';

import type { Evidence } from './entitlement-evidence.ts';
import type { PremiumState } from './premium-state.ts';
import type { PurchaseFailure } from '@e07/shell/services/purchase/purchase-port.ts';

// Failures count only while a purchase is in flight: iOS reports a failed requestPurchase
// both as a rejected promise AND on purchaseErrorListener, so duplicates must be no-ops.
export function onPurchaseFailed(state: PremiumState, failure: PurchaseFailure): PremiumState {
  if (state.flow.kind !== 'purchasing') return state;
  const price = state.flow.price;
  switch (failure) {
    case 'cancelled':
      return { ...state, flow: { kind: 'ready', price } }; // quietly back, no error
    case 'deferred':
      return { ...state, flow: { kind: 'pending', price } };
    case 'already-owned':
      return { ...state, flow: { kind: 'restoring', price } }; // the service runs restore
    case 'unavailable':
      return { ...state, flow: { kind: 'unavailable' } };
    case 'failed':
      return { ...state, flow: { kind: 'failed', price } };
  }
}

export function onRestoreFinished(
  state: PremiumState,
  evidence: Evidence | 'sync-failed',
): PremiumState {
  const price = priceOf(state.flow);
  if (evidence === 'sync-failed') return { ...state, flow: { kind: 'restore-failed', price } };
  if (evidence === 'owned') {
    // A restore is not a purchase: the "restored" toast, never the thank-you animation.
    const flow = readyOrUnavailable(price);
    return { ...state, isPremium: true, didJustPurchase: false, didJustRestore: true, flow };
  }
  if (evidence === 'revoked')
    return { ...state, isPremium: false, flow: readyOrUnavailable(price) };
  // Sync succeeded and there is no evidence: "nothing to restore" (never after a failed sync).
  const flow = state.isPremium
    ? readyOrUnavailable(price)
    : { kind: 'restore-empty' as const, price };
  return { ...state, flow };
}

// Silent re-check at launch/foreground: only explicit evidence changes the entitlement.
export function onEntitlementsChecked(state: PremiumState, evidence: Evidence): PremiumState {
  if (evidence === 'owned') return { ...state, isPremium: true };
  if (evidence === 'revoked') return { ...state, isPremium: false, didJustPurchase: false };
  return state;
}

export function onGranted(state: PremiumState): PremiumState {
  const wasBuying = state.flow.kind === 'purchasing' || state.flow.kind === 'pending';
  return {
    ...state,
    isPremium: true,
    didJustPurchase: state.didJustPurchase || wasBuying,
    flow: readyOrUnavailable(priceOf(state.flow)),
  };
}
