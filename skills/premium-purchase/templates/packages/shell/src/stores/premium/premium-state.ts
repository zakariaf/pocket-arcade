// packages/shell/src/stores/premium/premium-state.ts
import type { Evidence } from './entitlement-evidence.ts';
import type { PurchaseFailure } from '@e07/shell/services/purchase/purchase-port.ts';

// Store-flow states. `price` is the formatted price, kept so the page stays readable.
export type PremiumFlow =
  | { readonly kind: 'loading' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'ready'; readonly price: string }
  | { readonly kind: 'purchasing'; readonly price: string }
  | { readonly kind: 'pending'; readonly price: string }
  | { readonly kind: 'failed'; readonly price: string }
  | { readonly kind: 'restoring'; readonly price: string | null }
  | { readonly kind: 'restore-empty'; readonly price: string | null }
  | { readonly kind: 'restore-failed'; readonly price: string | null };

export type PremiumState = {
  readonly isPremium: boolean; // persisted; survives "Reset all progress"
  readonly didJustPurchase: boolean; // one thank-you animation (S12 Success)
  readonly didJustRestore: boolean; // one "Purchase restored" toast
  readonly flow: PremiumFlow;
};

export type PremiumAction =
  | { readonly type: 'connect-started' }
  | { readonly type: 'store-unavailable' }
  | { readonly type: 'price-loaded'; readonly price: string }
  | { readonly type: 'buy-tapped' }
  | { readonly type: 'purchase-failed'; readonly failure: PurchaseFailure }
  | { readonly type: 'purchase-pending' }
  | { readonly type: 'premium-granted' } // dispatched AFTER the save was written
  | { readonly type: 'restore-tapped' }
  | { readonly type: 'restore-finished'; readonly evidence: Evidence | 'sync-failed' }
  | { readonly type: 'entitlements-checked'; readonly evidence: Evidence }
  | { readonly type: 'thanks-shown' }
  | { readonly type: 'restore-notice-shown' }
  // Test builds only: the debug switch / link premium=0|1 (spec S15), after the save was written.
  | { readonly type: 'debug-premium-set'; readonly isPremium: boolean };

export function initialPremiumState(isPremium: boolean): PremiumState {
  return { isPremium, didJustPurchase: false, didJustRestore: false, flow: { kind: 'loading' } };
}

export function priceOf(flow: PremiumFlow): string | null {
  return 'price' in flow ? flow.price : null;
}

export function readyOrUnavailable(price: string | null): PremiumFlow {
  return price === null ? { kind: 'unavailable' } : { kind: 'ready', price };
}
