// packages/shell/src/stores/premium/premium-transitions.ts
import { priceOf, readyOrUnavailable } from './premium-state.ts';

import type { Evidence } from './entitlement-evidence.ts';
import type { PremiumFlow, PremiumState } from './premium-state.ts';
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

type RestoreOutcomeFlow = Extract<
  PremiumFlow,
  { readonly kind: 'restore-empty' | 'restore-failed' }
>;

// The page an ended restore leaves: "nothing to restore" or "couldn't restore" over the offer.
function isRestoreOutcomeFlow(flow: PremiumFlow): flow is RestoreOutcomeFlow {
  return flow.kind === 'restore-empty' || flow.kind === 'restore-failed';
}

// The store's price: it opens the page, and a price that arrives during a restore started while it
// loaded (or right after that restore) is kept, so BUY can show it; a late one after "unavailable"
// is ignored.
export function onPriceLoaded(state: PremiumState, price: string): PremiumState {
  const { flow } = state;
  if (flow.kind === 'loading') return { ...state, flow: { kind: 'ready', price } };
  const isRestore = flow.kind === 'restoring' || isRestoreOutcomeFlow(flow);
  return isRestore && flow.price === null ? { ...state, flow: { ...flow, price } } : state;
}

// A restore during Ask to Buy (spec S12 Pending) keeps the approval outstanding: it comes back to
// "waiting for approval" unless it finds the purchase, so BUY never opens a second purchase. A tap
// while a restore runs changes nothing, so that restore keeps what it is waiting for.
export function onRestoreTapped(state: PremiumState): PremiumState {
  const { flow } = state;
  if (flow.kind === 'restoring') return state;
  if (flow.kind === 'pending')
    return { ...state, flow: { kind: 'restoring', price: flow.price, isAwaitingApproval: true } };
  return { ...state, flow: { kind: 'restoring', price: priceOf(flow) } };
}

function isAwaitingApproval(state: PremiumState): boolean {
  return state.flow.kind === 'restoring' && state.flow.isAwaitingApproval === true;
}

// A restore is not a purchase: the "restored" toast, never the thank-you animation.
function restored(state: PremiumState, price: string | null): PremiumState {
  const flow = readyOrUnavailable(price);
  return { ...state, isPremium: true, didJustPurchase: false, didJustRestore: true, flow };
}

// A restore that ends after the page moved on (the Ask-to-Buy approval granted Premium first, or an
// earlier restore already answered) changes only the entitlement: the thank-you, "waiting for
// approval" and the page stay. Only a purchase it finds for a player without Premium is "restored".
function onLateRestoreFinished(
  state: PremiumState,
  evidence: Evidence | 'sync-failed',
): PremiumState {
  if (evidence === 'owned' && !state.isPremium) return restored(state, priceOf(state.flow));
  return evidence === 'sync-failed' ? state : onEntitlementsChecked(state, evidence);
}

export function onRestoreFinished(
  state: PremiumState,
  evidence: Evidence | 'sync-failed',
): PremiumState {
  if (state.flow.kind !== 'restoring') return onLateRestoreFinished(state, evidence);
  const price = priceOf(state.flow);
  if (isAwaitingApproval(state) && evidence !== 'owned' && price !== null)
    return { ...state, flow: { kind: 'pending', price } };
  if (evidence === 'sync-failed') return { ...state, flow: { kind: 'restore-failed', price } };
  if (evidence === 'owned') return restored(state, price);
  if (evidence === 'revoked')
    return { ...state, isPremium: false, flow: readyOrUnavailable(price) };
  // Sync succeeded and there is no evidence: "nothing to restore" (never after a failed sync).
  const flow = state.isPremium
    ? readyOrUnavailable(price)
    : { kind: 'restore-empty' as const, price };
  return { ...state, flow };
}

// S12 opened on a restore outcome it never saw end (a restore from Settings, or a visit before):
// no "Purchase restored", and an empty or failed restore's page sells again, so no stale toast shows.
export function onRestoreOutcomeCleared(state: PremiumState): PremiumState {
  const { flow } = state;
  const isOutcomeFlow = isRestoreOutcomeFlow(flow);
  if (!isOutcomeFlow && !state.didJustRestore) return state;
  return {
    ...state,
    didJustRestore: false,
    flow: isOutcomeFlow ? readyOrUnavailable(flow.price) : flow,
  };
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
