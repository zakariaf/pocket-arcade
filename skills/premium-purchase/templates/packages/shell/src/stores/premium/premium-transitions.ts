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

// The store's price: it opens the page, and a price that arrives during a restore started while it
// loaded (or right after that restore) is kept, so BUY can show it; a late one after "unavailable"
// is ignored.
export function onPriceLoaded(state: PremiumState, price: string): PremiumState {
  const { flow } = state;
  if (flow.kind === 'loading') return { ...state, flow: { kind: 'ready', price } };
  const isRestore =
    flow.kind === 'restoring' || flow.kind === 'restore-empty' || flow.kind === 'restore-failed';
  return isRestore && flow.price === null ? { ...state, flow: { ...flow, price } } : state;
}

// A restore during Ask to Buy (spec S12 Pending) keeps the approval outstanding: it comes back to
// "waiting for approval" unless it finds the purchase, so BUY never opens a second purchase.
export function onRestoreTapped(state: PremiumState): PremiumState {
  const { flow } = state;
  if (flow.kind === 'pending')
    return { ...state, flow: { kind: 'restoring', price: flow.price, isAwaitingApproval: true } };
  return { ...state, flow: { kind: 'restoring', price: priceOf(flow) } };
}

function isAwaitingApproval(state: PremiumState): boolean {
  return state.flow.kind === 'restoring' && state.flow.isAwaitingApproval === true;
}

export function onRestoreFinished(
  state: PremiumState,
  evidence: Evidence | 'sync-failed',
): PremiumState {
  const price = priceOf(state.flow);
  if (isAwaitingApproval(state) && evidence !== 'owned' && price !== null)
    return { ...state, flow: { kind: 'pending', price } };
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

// Silent re-check at launch, foreground and reconnect: only explicit evidence changes the
// entitlement, and a check that changes nothing returns the same state (the store publishes nothing).
export function onEntitlementsChecked(state: PremiumState, evidence: Evidence): PremiumState {
  if (evidence === 'owned') return state.isPremium ? state : { ...state, isPremium: true };
  if (evidence === 'revoked' && (state.isPremium || state.didJustPurchase))
    return { ...state, isPremium: false, didJustPurchase: false };
  return state;
}

export function onGranted(state: PremiumState): PremiumState {
  const wasBuying =
    state.flow.kind === 'purchasing' || state.flow.kind === 'pending' || isAwaitingApproval(state);
  return {
    ...state,
    isPremium: true,
    didJustPurchase: state.didJustPurchase || wasBuying,
    flow: readyOrUnavailable(priceOf(state.flow)),
  };
}
