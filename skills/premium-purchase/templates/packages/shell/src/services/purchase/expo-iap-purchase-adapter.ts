// packages/shell/src/services/purchase/expo-iap-purchase-adapter.ts
// device-only: covered by check-premium-behaviour.mjs (a scripted expo-iap) and the StoreKit Tier 2 harness.
// The ONLY file allowed to import expo-iap. Banned here and everywhere: kitApi, KitApiError,
// verifyPurchaseWithProvider, verifyPurchase({ google }), useIAP (hidden auto-finish logic).
import {
  ErrorCode,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases,
} from 'expo-iap';

import type {
  PurchaseEvent,
  PurchaseFailure,
  PurchasePort,
  StoreProduct,
  StoreTransaction,
} from './purchase-port.ts';
import type { Purchase } from 'expo-iap';

const FAILURES: Partial<Record<string, PurchaseFailure>> = {
  [ErrorCode.UserCancelled]: 'cancelled',
  [ErrorCode.DeferredPayment]: 'deferred',
  [ErrorCode.Pending]: 'deferred',
  [ErrorCode.AlreadyOwned]: 'already-owned',
  [ErrorCode.NetworkError]: 'unavailable',
  [ErrorCode.ServiceError]: 'unavailable',
  [ErrorCode.ServiceDisconnected]: 'unavailable',
  [ErrorCode.ServiceTimeout]: 'unavailable',
  [ErrorCode.BillingUnavailable]: 'unavailable',
  [ErrorCode.IapNotAvailable]: 'unavailable',
  [ErrorCode.InitConnection]: 'unavailable',
  [ErrorCode.ConnectionClosed]: 'unavailable',
  [ErrorCode.NotPrepared]: 'unavailable',
};

function failureEvent(error: unknown): PurchaseEvent {
  const code: unknown =
    typeof error === 'object' && error !== null ? Reflect.get(error, 'code') : null;
  const text = typeof code === 'string' ? code : 'unknown';
  return { type: 'failure', failure: FAILURES[text] ?? 'failed', code: text };
}

function toTransaction(purchase: Purchase): StoreTransaction | null {
  if (purchase.purchaseState === 'unknown') return null;
  const revoked = 'revocationDateIOS' in purchase ? purchase.revocationDateIOS : null;
  return {
    productId: purchase.productId,
    transactionId: purchase.transactionId ?? purchase.id,
    state: purchase.purchaseState,
    revocationDateMs: revoked ?? null,
    handle: purchase,
  };
}

function createEmitter(): {
  emit: (event: PurchaseEvent) => void;
  subscribe: PurchasePort['subscribe'];
} {
  const listeners = new Set<(event: PurchaseEvent) => void>();
  const emit = (event: PurchaseEvent): void => {
    listeners.forEach((listener) => {
      listener(event);
    });
  };
  const subscribe: PurchasePort['subscribe'] = (listener) => {
    listeners.add(listener);
    const updated = purchaseUpdatedListener((purchase) => {
      const transaction = toTransaction(purchase);
      if (transaction !== null) listener({ type: 'transaction', transaction });
    });
    const failed = purchaseErrorListener((error) => {
      listener(failureEvent(error));
    });
    return () => {
      listeners.delete(listener);
      updated.remove();
      failed.remove();
    };
  };
  return { emit, subscribe };
}

async function fetchProduct(productId: string): Promise<StoreProduct | null> {
  const products = (await fetchProducts({ skus: [productId], type: 'in-app' })) ?? [];
  const product = products.find((item) => item.id === productId);
  if (product === undefined) return null; // StoreKit returns [] instead of throwing
  const { displayPrice, currency } = product;
  return { productId, displayPrice, currency, price: product.price ?? null };
}

async function restore(): Promise<'synced' | 'sync-failed'> {
  try {
    await restorePurchases(); // iOS: AppStore.sync(); throws ErrorCode.SyncError on failure/cancel
    return 'synced';
  } catch {
    return 'sync-failed'; // never report "nothing to restore" after a failed sync
  }
}

async function readTransactions(): Promise<readonly StoreTransaction[]> {
  // false = Transaction.all, which still contains refunded purchases (revocation evidence).
  const purchases = await getAvailablePurchases({ onlyIncludeActiveItemsIOS: false });
  return purchases.map(toTransaction).filter((tx) => tx !== null);
}

export function createExpoIapPurchaseAdapter(): PurchasePort {
  const { emit, subscribe } = createEmitter();
  return {
    connect: () => initConnection(),
    fetchProduct,
    requestPurchase: async (productId) => {
      try {
        await requestPurchase({
          request: { apple: { sku: productId }, google: { skus: [productId] } },
          type: 'in-app',
        });
      } catch (error) {
        emit(failureEvent(error)); // may duplicate purchaseErrorListener: the reducer ignores repeats
      }
    },
    finish: (transaction) =>
      finishTransaction({ purchase: transaction.handle as Purchase, isConsumable: false }),
    restore,
    readTransactions,
    subscribe,
  };
}
