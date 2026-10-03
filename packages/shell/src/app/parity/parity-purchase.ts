// packages/shell/src/app/parity/parity-purchase.ts
// Test builds only (reached through test-only.ts). The store of a parity launch: the fixture's
// product (price and currency from parity-fixture-save.json, formatted by the Shell like a StoreKit
// price, so no price is ever typed), an owned transaction on Premium frames, and the store
// behaviour each S12 state card draws. The Premium screen's model presses Buy or Restore itself
// on the states that need it (parityFrameState()); this port only answers.
import { localeTagFor } from '@e07/shell/i18n/digits.ts';

import { PARITY_FIXTURE } from './parity-fixture.ts';

import type { ParityFixture } from './parity-fixture.ts';
import type { ParityPlan, ParityState } from './parity-plans.ts';
import type {
  PurchaseEvent,
  PurchasePort,
  StoreProduct,
  StoreTransaction,
} from '@e07/shell/services/purchase/purchase-port.ts';

export type ParityPurchaseInput = {
  readonly productId: string;
  readonly plan: Pick<ParityPlan, 'premium' | 'state'>;
  /** Defaults to the committed fixture's store block. */
  readonly store?: ParityFixture['store'];
};

/** A promise that never settles: the state card that waits (loading price, purchase sheet up). */
function pending<T>(): Promise<T> {
  return new Promise<T>(() => undefined);
}

function productOf(productId: string, store: ParityFixture['store']): StoreProduct {
  // The store-formatted fallback, built like StoreKit's; the Shell formats per language anyway.
  const displayPrice = new Intl.NumberFormat(localeTagFor('en', 'latin'), {
    style: 'currency',
    currency: store.currency,
  }).format(store.price);
  return { productId, displayPrice, price: store.price, currency: store.currency };
}

function transactionOf(productId: string, state: StoreTransaction['state']): StoreTransaction {
  return { productId, transactionId: 'parity-1', state, revocationDateMs: null, handle: null };
}

/** What the store answers after Buy on the S12 purchase states (absent: the sheet stays up). */
const PURCHASE_OUTCOMES: Partial<Record<ParityState, 'pending' | 'purchased' | 'failed'>> = {
  'premium-pending-approval': 'pending',
  'premium-success': 'purchased',
  'premium-error': 'failed',
};

function purchaseOutcome(
  plan: ParityPurchaseInput['plan'],
  productId: string,
): PurchaseEvent | null {
  const outcome = plan.state === null ? undefined : PURCHASE_OUTCOMES[plan.state];
  if (outcome === undefined) return null;
  if (outcome === 'failed') return { type: 'failure', failure: 'failed', code: 'parity-error' };
  return { type: 'transaction', transaction: transactionOf(productId, outcome) };
}

export function createParityPurchase(input: ParityPurchaseInput): PurchasePort {
  const { productId, plan } = input;
  const store = input.store ?? PARITY_FIXTURE.store;
  const listeners = new Set<(event: PurchaseEvent) => void>();
  const isOwned = plan.premium || plan.state === 'premium-already-owned';
  const isUnavailable = plan.state === 'premium-store-unavailable';
  return {
    connect: () => Promise.resolve(!isUnavailable),
    fetchProduct: () => {
      if (plan.state === 'premium-loading-price') return pending();
      return Promise.resolve(isUnavailable ? null : productOf(productId, store));
    },
    requestPurchase: () => {
      const outcome = purchaseOutcome(plan, productId);
      if (outcome === null) return pending();
      // After the request resolved, like StoreKit: the outcome arrives through subscribe() on the
      // next turn (setImmediate, so a test's flushMicrotasks() sees it without sleeping).
      setImmediate(() => {
        listeners.forEach((listener) => {
          listener(outcome);
        });
      });
      return Promise.resolve();
    },
    finish: () => Promise.resolve(),
    restore: () => Promise.resolve('synced'),
    readTransactions: () => Promise.resolve(isOwned ? [transactionOf(productId, 'purchased')] : []),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
