// packages/shell/src/services/purchase/purchase-port.ts
export type StoreProduct = {
  readonly productId: string;
  readonly displayPrice: string; // store-formatted fallback
  readonly price: number | null;
  readonly currency: string;
};

// A StoreKit 2 transaction the platform has already verified on device (JWS checked).
export type StoreTransaction = {
  readonly productId: string;
  readonly transactionId: string;
  readonly state: 'purchased' | 'pending';
  readonly revocationDateMs: number | null; // refund / Family Sharing revocation evidence
  readonly handle: unknown; // opaque; given back to finish()
};

export type PurchaseFailure = 'cancelled' | 'deferred' | 'already-owned' | 'unavailable' | 'failed';

export type PurchaseEvent =
  | { readonly type: 'transaction'; readonly transaction: StoreTransaction }
  | { readonly type: 'failure'; readonly failure: PurchaseFailure; readonly code: string };

export type PurchasePort = {
  readonly connect: () => Promise<boolean>;
  // null when the store returns no product (StoreKit returns [] instead of throwing).
  readonly fetchProduct: (productId: string) => Promise<StoreProduct | null>;
  // Resolves when the sheet was requested; the outcome arrives through subscribe().
  readonly requestPurchase: (productId: string) => Promise<void>;
  readonly finish: (transaction: StoreTransaction) => Promise<void>;
  // AppStore.sync(). 'sync-failed' covers a cancelled Apple Account prompt and offline.
  readonly restore: () => Promise<'synced' | 'sync-failed'>;
  // Every verified transaction incl. refunded ones (Transaction.all), for evidence.
  readonly readTransactions: () => Promise<readonly StoreTransaction[]>;
  readonly subscribe: (listener: (event: PurchaseEvent) => void) => () => void;
};
