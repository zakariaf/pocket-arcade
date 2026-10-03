// packages/shell/src/services/purchase/connectivity-gated-purchase.ts
// The store follows ConnectivityPort. While offline (really, or through the test build's
// "Simulate offline" switch, debug link offline=1) it reports itself unavailable without asking
// StoreKit: S12 shows "store unavailable" at once and a restore ends in "couldn't restore".
import type { PurchasePort, StoreTransaction } from './purchase-port.ts';

// Absence is never evidence: an offline re-check changes nothing (the cached Premium stays).
const NO_TRANSACTIONS: readonly StoreTransaction[] = [];

export function withConnectivity(port: PurchasePort, isOnline: () => boolean): PurchasePort {
  return {
    ...port,
    connect: () => (isOnline() ? port.connect() : Promise.resolve(false)),
    fetchProduct: (productId) =>
      isOnline() ? port.fetchProduct(productId) : Promise.resolve(null),
    restore: () => (isOnline() ? port.restore() : Promise.resolve('sync-failed' as const)),
    readTransactions: () =>
      isOnline() ? port.readTransactions() : Promise.resolve(NO_TRANSACTIONS),
  };
}
