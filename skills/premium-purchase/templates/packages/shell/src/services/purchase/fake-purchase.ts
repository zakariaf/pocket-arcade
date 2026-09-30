// packages/shell/src/services/purchase/fake-purchase.ts
import type {
  PurchaseEvent,
  PurchasePort,
  StoreProduct,
  StoreTransaction,
} from './purchase-port.ts';

export type FakePurchaseScript = {
  isConnected: boolean;
  product: StoreProduct | null;
  restoreResult: 'synced' | 'sync-failed';
  transactions: StoreTransaction[];
  readonly calls: string[];
};

export type FakePurchase = PurchasePort & { readonly emit: (event: PurchaseEvent) => void };

export function createFakePurchase(script: FakePurchaseScript): FakePurchase {
  const listeners = new Set<(event: PurchaseEvent) => void>();
  const call = <T>(name: string, value: T): Promise<T> => {
    script.calls.push(name);
    return Promise.resolve(value);
  };
  return {
    connect: () => call('connect', script.isConnected),
    fetchProduct: () => call('fetchProduct', script.product),
    requestPurchase: () => call('requestPurchase', undefined),
    finish: (tx) => call(`finish:${tx.transactionId}`, undefined),
    restore: () => call('restore', script.restoreResult),
    readTransactions: () => call('readTransactions', script.transactions),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit: (event) => {
      listeners.forEach((listener) => {
        listener(event);
      });
    },
  };
}
