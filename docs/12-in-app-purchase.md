# 12 · In-app purchase: Premium

> **What this doc decides.** How each game sells its one non-consumable "Premium" (spec N7, S12, 8.9, D2, D3) with no server: `expo-iap` 5.8.0 behind `PurchasePort`, the banned server features, the Premium reducer mapped to every S12 state, and the rules for persistence, revocation (explicit evidence only), restore (`sync-error`), pending (Ask to Buy) and an empty product list. It gives the three test tiers, including the verified hosted-XCTest StoreKit harness with its files and commands, the App Store Connect API script that creates the product, the price (€1.99, an App Store price point), Family Sharing (off) and the human steps.
> **Binding source:** [99-final-decisions.md](99-final-decisions.md) items 25 and 26 (plus 6, 9, 10, F), and section H items 2 to 4 (price €1.99, no Family Sharing, `io.applander.*` IDs). Build variants, signing and the store-artifact gate are in `docs/14-ios-build-and-release.md`. Problems found while writing are listed under [Open issues](#open-issues).
> **Related docs:** [06-navigation-state-persistence.md](06-navigation-state-persistence.md) (the premium save section), [13-privacy-network-security.md](13-privacy-network-security.md) (audit layers D and E), [14-ios-build-and-release.md](14-ios-build-and-release.md) (ASC client and human steps), [07-testing-and-tdd.md](07-testing-and-tdd.md) (fakes and flush helper), [02-architecture-and-folders.md](02-architecture-and-folders.md) (PurchasePort). Start at [00-README.md](00-README.md); how a session works is [17-claude-code-playbook.md](17-claude-code-playbook.md).

---

## 1. Introduction

Premium removes all ads and makes hints and continues free (D2). It is bought once per game, works offline forever after the purchase, and must survive reinstall through Restore. There is no server of ours, so every check happens on the phone with StoreKit 2, whose transactions are signed and verified on device.

Three facts drive the design (all verified on 2026-09-26):

- **StoreKit re-delivers transactions.** An unfinished purchase comes back at every launch, and even a finished, owned purchase was re-delivered through the update listener on relaunch. So every handler is idempotent, and Premium is saved **before** `finishTransaction`.
- **Absence is not evidence.** A fresh purchase can be missing from `Transaction.currentEntitlements` for a moment, and the purchase sheet makes the app inactive/active, which triggers a foreground re-check right after buying. Premium is revoked only when a verified transaction carries a revocation date.
- **Failures arrive twice on iOS.** A failed or deferred `requestPurchase` both rejects its promise and fires `purchaseErrorListener` with the same code. The reducer ignores the duplicate.

---

## 2. Rules

1. **Install `expo-iap` at exactly 5.8.0 and add its config plugin with no options** (`plugins: ['expo-iap']`). Fallback: 5.6.3 (openiap-apple 3.4.0).
   *Why:* FINAL 25; single-maintainer project with very frequent releases. `docs/01` owns the pin. **Source:** [npm](https://registry.npmjs.org/expo-iap), [openiap Expo setup](https://openiap.dev/docs/setup/expo).
2. **Only `packages/shell/src/services/purchase/expo-iap-purchase-adapter.ts` imports `expo-iap`.** Everything else uses `PurchasePort`.
   *Why:* FINAL F (ports and vendor-named adapters); upgrades touch one file.
3. **Never use `kitApi`, `KitApiError`, `verifyPurchaseWithProvider`, `verifyPurchase` (either branch) or `useIAP`. Never give the plugin any option (`iapkitApiKey`, `module: 'onside'`, `modules.onside`, `ios.alternativeBilling`, `enableLocalDev`, `localPath`, …), never set `expo.ios.onside.enabled`, and never set the environment variable `EXPO_IAP_ONSIDE=1`.**
   *Why:* `kitApi`/`verifyPurchaseWithProvider` call IAPKit (`https://kit.openiap.dev`), and the Google branch of `verifyPurchase` needs a server token. Each of the three Onside switches adds the OnsideKit pod from the CocoaPods trunk (N2/N3; read in the 5.8.0 plugin's `resolveModuleSelection` and `ExpoIap.podspec`). `useIAP` hides connection and finishing logic the Shell must own. Enforced by ESLint and by `audit:network` layers D and E (`docs/13`).
4. **One product per game: `<bundleId>.premium`, type NON_CONSUMABLE** (Line Siege: `io.applander.linesiege.premium`; bundle IDs are `io.applander.<game id without hyphens>`, FINAL H.4). The product ID never changes and is never reused.
   *Why:* spec N7; Apple does not allow reusing a product ID in the same app. **Source:** [In-App Purchase information](https://developer.apple.com/help/app-store-connect/reference/in-app-purchases-and-subscriptions/in-app-purchase-information).
5. **Subscribe to purchase events before connecting, then `initConnection` → `fetchProducts`.** An empty product list means "store unavailable", never an error dialog.
   *Why:* StoreKit replays transactions right after connecting; `Product.products` returns `[]` instead of throwing when it cannot resolve products (seen in the spike).
6. **On a verified `purchased` transaction: save Premium (synchronous SQLite write) → update the store → `finishTransaction({ purchase, isConsumable: false })`.** Never finish first, never use `andDangerouslyFinishTransactionAutomatically`.
   *Why:* if the app dies between steps, StoreKit re-delivers the unfinished transaction; a finished-but-unsaved purchase would be lost (FINAL 25).
7. **Map `deferred-payment` / `pending` / a `pending` purchase state to the S12 "Waiting for approval" state.** The approval arrives later through the update listener and turns Premium on automatically.
   *Why:* spec S12 Pending; Ask to Buy on iOS is StoreKit `.pending`, which openiap maps to `deferred-payment` (verified in the harness).
8. **Restore = `restorePurchases()` (AppStore.sync) followed by reading the transactions.** A failed sync (`sync-error`, a cancelled Apple Account prompt, offline) shows "couldn't restore", never "nothing to restore". "Nothing to restore" is shown only after a successful sync with no evidence.
   *Why:* FINAL 25; `restorePurchases` throws `ErrorCode.SyncError` when the sync does not complete (read in `src/utils/restorePurchases.ts`).
9. **Revoke Premium only on explicit evidence: a verified Premium transaction with `revocationDateIOS` set and no non-revoked Premium transaction.** Never on absence, on an error, or offline.
   *Why:* FINAL 25; verified that a fresh purchase can be briefly missing and that a refund shows up as a revocation date in `Transaction.all`.
10. **Re-check silently at launch and on return to foreground, only when the store is reachable, with `getAvailablePurchases({ onlyIncludeActiveItemsIOS: false })` (`Transaction.all`).** Any error keeps the cached state.
    *Why:* spec 8.9 ("quietly re-checks … at app start"); `Transaction.all` includes refunded purchases, which the active list does not (verified).
11. **Persist Premium in the save document's `premium` section (docs/06), which "Reset all progress" never clears; a revocation is saved with its `revocationDateMs`.** Premium then works offline forever.
    *Why:* FINAL 6 and spec 8.9, S11.
12. **Make every purchase handler idempotent** (the same transaction or failure may arrive twice).
    *Why:* verified replays and duplicate failures (section 1).
13. **Show the price the store reports, formatted with the player's digits** (`formatStorePrice`); fall back to the store's `displayPrice`. Never type a price into code or catalogs.
    *Why:* spec S12 ("Never typed into the code") and 7.3.
14. **All S12 text comes from our catalogs**, in all four languages. App Store Connect product texts exist only in en-US and de-DE.
    *Why:* App Store Connect has no Persian or Sorani localization (checked 2026-09-26). **Source:** [App Store localizations](https://developer.apple.com/help/app-store-connect/reference/app-information/app-store-localizations).
15. **Design and test every S12 state** (section 3.4): reducer tests for all of them (Tier 1), the StoreKit harness before each release and after every `expo-iap` upgrade (Tier 2), and the owner's TestFlight run for each game (Tier 3).
    *Why:* spec 15.5 and FINAL 26.
16. **The StoreKit harness exists only in harness builds:** a fresh test-variant prebuild on a throwaway simulator. `get-task-allow` is added for the **Debug** configuration only. Store and TestFlight builds never contain the harness target, `Premium.storekit` or `get-task-allow`; `docs/14`'s store-artifact gate checks it.
    *Why:* FINAL 26; `get-task-allow` must never ship.
17. **Create the product with the App Store Connect API script (section 3.10)** using `docs/14`'s JWT client, always with `familySharable: false` (the owner decided: no Family Sharing, FINAL H.3). The price is the App Store price point €1.99 in the base territory Germany (FINAL H.2, spec D3).
    *Why:* FINAL 9 (ASC REST only where altool lacks a feature); Family Sharing cannot be turned off once on. **Source:** [Family Sharing for in-app purchases](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/turn-on-family-sharing-for-in-app-purchases).
18. **Never push Premium with pop-ups.** The only entry points are the Home button (hidden once owned), the Settings row, and at most one line on the Result screen per day.
    *Why:* spec S12 Rules.
19. **Family Sharing stays off everywhere a Premium product is described:** `"familyShareable" : false` in every StoreKit configuration, `familySharable: false` in the API body (a constant, not an option), and "leave Family Sharing off" in the App Store Connect steps. The premium-purchase skill's checker `check-premium` (section 3.8) fails a StoreKit configuration whose product is shareable (rule `family-sharing`), is not the one NON_CONSUMABLE product `<bundleId>.premium` (`storekit-config`) or is not priced 1.99 (`price-target`), on the committed template, on every generated `apps/<id>/ios/*.storekit` and on the App Store Connect payloads (FINAL H.20, L14).
    *Why:* the owner's decision O3 (FINAL H.3); once Family Sharing is on for a product, Apple cannot turn it off. **Source:** [Family Sharing for in-app purchases](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/turn-on-family-sharing-for-in-app-purchases).

---

## 3. Details

### 3.1 Versions, plugin and bans

| Item | Version (2026-09-26) | Note |
|---|---|---|
| `expo-iap` | 5.8.0 exact | openiap-apple 3.6.0 (StoreKit 2), openiap-google 3.6.0 (Play Billing 9.1.0) |
| Fallback | 5.6.3 | openiap-apple 3.4.0 (2026-08-31) |
| iOS deployment target | 16.4 | Expo SDK 57 default; expo-iap's validated baseline |
| Android later | Kotlin 2.1.20 via `expo-build-properties` | per openiap's Expo setup page |

```sh
# inside apps/<game>
npm install -E expo-iap@5.8.0
npx expo prebuild --platform ios --clean
```

Plugin entry in `withShell` (no options object at all): `'expo-iap'`. No iOS entitlement is needed for in-app purchase: the verified harness purchases ran with an app whose `.entitlements` file was empty apart from the Debug-only `get-task-allow`; signed builds are confirmed by the owner's Tier-3 TestFlight run.

**Re-verify:** `npm view expo-iap version time --json` (the new version must be at least 7 days old, `docs/01`); read the release notes and `openiap-versions.json` of the tarball; rerun Tier 1, Tier 2 and a Tier-3 TestFlight buy/restore before shipping the upgrade.

ESLint: docs/04's `VENDOR_SDK_PATHS` bans `expo-iap` everywhere except the adapters, and the purchase-adapter block after `ADAPTERS` (`EXPO_IAP_SERVER_APIS`) keeps `kitApi`, `KitApiError`, `verifyPurchaseWithProvider`, `verifyPurchase` and `useIAP` banned inside `expo-iap-purchase-adapter.ts` too; see [docs/04 section 3](04-code-style-and-limits.md#3-eslint-the-complete-eslintconfigmjs).

### 3.2 `PurchasePort`

```ts
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
```

### 3.3 The expo-iap adapter

```ts
// packages/shell/src/services/purchase/expo-iap-purchase-adapter.ts
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
```

How `expo-iap` 5.8.0 errors map to S12 (codes are the string values of its `ErrorCode` enum):

| `ErrorCode` value | `PurchaseFailure` | S12 result |
|---|---|---|
| `user-cancelled` | `cancelled` | quietly back to the page, no message |
| `deferred-payment`, `pending` | `deferred` | "Waiting for approval – you can keep playing." |
| `already-owned` | `already-owned` | runs Restore automatically |
| `network-error`, `service-error`, `service-disconnected`, `service-timeout`, `billing-unavailable`, `iap-not-available`, `init-connection`, `connection-closed`, `not-prepared` | `unavailable` | "Connect to the internet to buy or restore." |
| anything else (`unknown`, `purchase-error`, `item-unavailable`, `sku-not-found`, `query-product`, …) | `failed` | "The purchase couldn't be completed. You were not charged." + Try again |
| `sync-error` (from `restorePurchases` only) | — | "Couldn't restore. Check your connection and try again." |

Facts behind the adapter (read in the 5.8.0 source and openiap-apple, and seen in the harness):
- `getAvailablePurchases()` defaults to `onlyIncludeActiveItemsIOS: true` (`Transaction.currentEntitlements`); the adapter passes `false` to read `Transaction.all`.
- `restorePurchases()` returns `void` (it runs `AppStore.sync()` and then `getAvailablePurchases` internally), so the service reads the transactions afterwards.
- On iOS a failed `requestPurchase` both rejects and emits on `purchaseErrorListener` (openiap's `requestPurchase` calls `emitPurchaseError` before rethrowing); the harness logged `request rejected code=deferred-payment` and `listener-error code=deferred-payment` for one Ask-to-Buy.
- A test-environment failure (`failTransactionsEnabled`) arrived as code `unknown` → `failed`.
- `purchaseUpdatedListener` de-duplicates by transaction ID within a connection session, but a relaunch re-delivered the owned purchase.
- The StoreKit `Product.price` arrives as a binary double (`1.9899999999999998` for 1.99); currency formatting rounds it correctly.

### 3.4 The Premium reducer and every S12 state

```ts
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
  | { readonly type: 'thanks-shown' };

export function initialPremiumState(isPremium: boolean): PremiumState {
  return { isPremium, didJustPurchase: false, flow: { kind: 'loading' } };
}

export function priceOf(flow: PremiumFlow): string | null {
  return 'price' in flow ? flow.price : null;
}

export function readyOrUnavailable(price: string | null): PremiumFlow {
  return price === null ? { kind: 'unavailable' } : { kind: 'ready', price };
}
```

```ts
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
  if (evidence === 'owned') return { ...state, isPremium: true, flow: readyOrUnavailable(price) };
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
    isPremium: true,
    didJustPurchase: state.didJustPurchase || wasBuying,
    flow: readyOrUnavailable(priceOf(state.flow)),
  };
}
```

```ts
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
  }
}
```

```ts
// packages/shell/src/stores/premium/premium-view.ts
import type { PremiumFlow, PremiumState } from './premium-state.ts';

// One value per S12 state the screen must design and test (spec S12 "States").
export type PremiumView =
  | 'loading-price' // spinner on BUY, rest readable
  | 'store-unavailable' // "Connect to the internet to buy or restore." BUY disabled
  | 'ready' // price + BUY + Restore
  | 'purchase-in-progress' // buttons locked, spinner
  | 'pending' // "Waiting for approval - you can keep playing."
  | 'success' // thank-you animation, then 'already-owned'
  | 'error' // "The purchase couldn't be completed. You were not charged." + Try again
  | 'already-owned' // "Premium - active" + Restore
  | 'restoring' // Restore link spinner
  | 'restore-empty' // "No purchase to restore was found."
  | 'restore-failed'; // "Couldn't restore. Check your connection and try again."
// 'Cancelled by player' has no view of its own: it returns quietly to 'ready'.

const FLOW_VIEW: Readonly<Record<PremiumFlow['kind'], PremiumView>> = {
  loading: 'loading-price',
  unavailable: 'store-unavailable',
  ready: 'ready',
  purchasing: 'purchase-in-progress',
  pending: 'pending',
  failed: 'error',
  restoring: 'restoring',
  'restore-empty': 'restore-empty',
  'restore-failed': 'restore-failed',
};

export function premiumView(state: PremiumState): PremiumView {
  if (state.isPremium) return state.didJustPurchase ? 'success' : 'already-owned';
  return FLOW_VIEW[state.flow.kind];
}
```

Every S12 state, where it comes from, and what the screen shows (catalog keys are the Shell's; `testID`s follow `<screen>.<element>`):

| Spec S12 state | `PremiumView` | Reached by | Screen (catalog key) | `testID` |
|---|---|---|---|---|
| Loading price | `loading-price` | `connect-started` | spinner on BUY, rest readable | `premium.state.loading` |
| Store unavailable / offline | `store-unavailable` | empty `fetchProducts`, `initConnection` failure, `unavailable` failure | `premium.store-unavailable`, BUY disabled | `premium.state.unavailable` |
| (normal page) | `ready` | `price-loaded`, `cancelled` | `premium.buy-button` = "Buy – {priceText}", Restore link | `premium.buy-button`, `premium.restore-button` (on every state) |
| Purchase in progress | `purchase-in-progress` | `buy-tapped` | buttons locked, spinner | `premium.state.purchasing` |
| Pending | `pending` | `deferred` failure or `pending` transaction | `premium.pending` | `premium.state.pending` |
| Success | `success` | `premium-granted` while buying/pending | thank-you animation, then `thanks-shown` | `premium.state.success` |
| Cancelled by player | `ready` | `cancelled` failure | no message | `premium.buy-button` |
| Error | `error` | `failed` failure | `premium.error` + `premium.try-again` | `premium.state.error` |
| Already owned | `already-owned` | persisted Premium, restore/re-check evidence | `premium.active` + Restore | `premium.state.owned` |
| (restore running) | `restoring` | `restore-tapped`, `already-owned` failure | Restore link spinner | `premium.state.restoring` |
| (nothing to restore) | `restore-empty` | successful sync, no evidence | `premium.restore-empty` | `premium.state.restore-empty` |
| (restore failed) | `restore-failed` | `sync-error` or read failure | `premium.restore-failed` | `premium.state.restore-failed` |

The Premium store (Zustand, FINAL 5) is thin: it holds `PremiumState`, applies `premiumReducer`, and hydrates `isPremium` from the save at splash. It follows docs/06's store pattern (a factory over the loaded save, provided through `StoresProvider` as `stores.premium`), except that it does not write the save: the service below persists first, then dispatches. Ads read `isPremium` from it, so they vanish everywhere at once (spec S12 Success). The "Remove ads – {priceText}" Settings row and the Home button use the same store.

```ts
// packages/shell/src/stores/premium/premium-store.ts
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { useStores } from '@e07/shell/app/stores-context.tsx';

import { premiumReducer } from './premium-reducer.ts';
import { initialPremiumState } from './premium-state.ts';

import type { PremiumAction, PremiumState } from './premium-state.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { StoreApi } from 'zustand/vanilla';

export type PremiumStoreState = PremiumState & {
  readonly dispatch: (action: PremiumAction) => void;
};

export type PremiumStore = StoreApi<PremiumStoreState>;

/**
 * Hydrated once from the save's `premium` section. Reduce -> publish only: the Premium
 * service writes the save through persistPremium BEFORE it dispatches (section 3.5).
 */
export function createPremiumStore(save: SaveService): PremiumStore {
  return createStore<PremiumStoreState>()((set, get) => ({
    ...initialPremiumState(save.doc().premium.owned),
    dispatch: (action) => {
      set(premiumReducer(get(), action));
    },
  }));
}

/** Primitives: `usePremiumStore((state) => state.isPremium)`; objects: `useShallow`. */
export function usePremiumStore<TSlice>(selector: (state: PremiumStoreState) => TSlice): TSlice {
  return useStore(useStores().premium, selector);
}
```

### 3.5 The Premium service: persistence, pending, restore, revocation

```ts
// packages/shell/src/stores/premium/entitlement-evidence.ts
import type { StoreTransaction } from '@e07/shell/services/purchase/purchase-port.ts';

// 'unknown' means "no evidence either way": the cached entitlement stays (FINAL-DECISIONS 25).
export type Evidence = 'owned' | 'revoked' | 'unknown';

export function entitlementEvidence(
  transactions: readonly StoreTransaction[],
  productId: string,
): Evidence {
  const premium = transactions.filter((tx) => tx.productId === productId);
  if (premium.some((tx) => tx.state === 'purchased' && tx.revocationDateMs === null))
    return 'owned';
  if (premium.some((tx) => tx.revocationDateMs !== null)) return 'revoked';
  return 'unknown'; // absence is NOT evidence: fresh purchases can be briefly missing
}

// The newest revocation date of this product (0 when there is none). docs/06's save guard
// keeps Premium on unless the write carries this date.
export function latestRevocationMs(
  transactions: readonly StoreTransaction[],
  productId: string,
): number {
  return transactions
    .filter((tx) => tx.productId === productId)
    .reduce((latest, tx) => Math.max(latest, tx.revocationDateMs ?? 0), 0);
}
```

```ts
// packages/shell/src/services/purchase/premium-service.ts
import {
  entitlementEvidence,
  latestRevocationMs,
} from '@e07/shell/stores/premium/entitlement-evidence.ts';

import type {
  PurchaseEvent,
  PurchasePort,
  StoreProduct,
  StoreTransaction,
} from './purchase-port.ts';
import type { Evidence } from '@e07/shell/stores/premium/entitlement-evidence.ts';
import type { PremiumAction } from '@e07/shell/stores/premium/premium-state.ts';

// What docs/06's `premium` save section records. A revocation carries its date.
export type PremiumChange =
  { readonly isPremium: true } | { readonly isPremium: false; readonly revokedAtMs: number };

export type PremiumServiceDeps = {
  readonly port: PurchasePort;
  readonly productId: string; // from game config, e.g. '<bundleId>.premium'
  readonly dispatch: (action: PremiumAction) => void;
  // Synchronous SQLite write into the premium section ("Reset all progress" keeps it).
  readonly persistPremium: (change: PremiumChange) => void;
  readonly formatPrice: (product: StoreProduct) => string;
  readonly onError: (error: unknown) => void; // ErrorLogPort
};

// Saves explicit evidence only ('unknown' changes nothing) and returns it.
function applyEvidence(
  deps: PremiumServiceDeps,
  transactions: readonly StoreTransaction[],
): Evidence {
  const evidence = entitlementEvidence(transactions, deps.productId);
  if (evidence === 'owned') deps.persistPremium({ isPremium: true });
  if (evidence === 'revoked') {
    const revokedAtMs = latestRevocationMs(transactions, deps.productId);
    deps.persistPremium({ isPremium: false, revokedAtMs });
  }
  return evidence;
}

// Launch, foreground and after an explicit revocation event. Errors keep the cached state.
export async function recheckPremium(deps: PremiumServiceDeps): Promise<void> {
  try {
    const evidence = applyEvidence(deps, await deps.port.readTransactions());
    deps.dispatch({ type: 'entitlements-checked', evidence });
  } catch (error) {
    deps.onError(error);
  }
}

async function finishQuietly(deps: PremiumServiceDeps, tx: StoreTransaction): Promise<void> {
  try {
    await deps.port.finish(tx);
  } catch (error) {
    deps.onError(error); // unfinished transactions are re-delivered at the next launch
  }
}

export async function processTransaction(
  deps: PremiumServiceDeps,
  tx: StoreTransaction,
): Promise<void> {
  if (tx.productId !== deps.productId) return;
  if (tx.state === 'pending') {
    deps.dispatch({ type: 'purchase-pending' });
    return;
  }
  if (tx.revocationDateMs !== null) {
    await recheckPremium(deps); // a newer, valid purchase still wins
    await finishQuietly(deps, tx);
    return;
  }
  deps.persistPremium({ isPremium: true }); // 1. the save is written (sync) ...
  deps.dispatch({ type: 'premium-granted' }); // 2. ads vanish everywhere at once ...
  await finishQuietly(deps, tx); // 3. ... and only then StoreKit may forget the transaction.
}

const SYNC_FAILED = 'sync-failed';

async function syncAndReadEvidence(
  deps: PremiumServiceDeps,
): Promise<Evidence | typeof SYNC_FAILED> {
  if ((await deps.port.restore()) === SYNC_FAILED) return SYNC_FAILED;
  try {
    return applyEvidence(deps, await deps.port.readTransactions());
  } catch (error) {
    deps.onError(error);
    return SYNC_FAILED;
  }
}

// S12 and Settings "Restore purchase": AppStore.sync(), then read the verified transactions.
export async function restorePremium(deps: PremiumServiceDeps): Promise<void> {
  deps.dispatch({ type: 'restore-tapped' });
  const evidence = await syncAndReadEvidence(deps);
  deps.dispatch({ type: 'restore-finished', evidence });
}

export async function processPurchaseEvent(
  deps: PremiumServiceDeps,
  event: PurchaseEvent,
): Promise<void> {
  if (event.type === 'transaction') {
    await processTransaction(deps, event.transaction);
    return;
  }
  deps.dispatch({ type: 'purchase-failed', failure: event.failure });
  if (event.failure === 'already-owned') await restorePremium(deps);
}
```

```ts
// packages/shell/src/services/purchase/premium-store-flow.ts
import { processPurchaseEvent, recheckPremium } from './premium-service.ts';

import type { PremiumServiceDeps } from './premium-service.ts';

// initConnection -> fetchProducts (empty => "store unavailable") -> price. Retried by the
// ConnectivityPort subscription when the flow is 'unavailable' and the phone comes online.
export async function loadStore(deps: PremiumServiceDeps): Promise<void> {
  deps.dispatch({ type: 'connect-started' });
  try {
    const isConnected = await deps.port.connect();
    const product = isConnected ? await deps.port.fetchProduct(deps.productId) : null;
    if (product === null) {
      deps.dispatch({ type: 'store-unavailable' });
      return;
    }
    deps.dispatch({ type: 'price-loaded', price: deps.formatPrice(product) });
  } catch (error) {
    deps.onError(error);
    deps.dispatch({ type: 'store-unavailable' });
  }
}

// App start: listen FIRST (StoreKit replays unfinished and approved Ask-to-Buy transactions
// right after connecting), then load the price, then re-check silently.
export async function startPremium(deps: PremiumServiceDeps): Promise<() => void> {
  const unsubscribe = deps.port.subscribe((event) => {
    processPurchaseEvent(deps, event).catch(deps.onError);
  });
  await loadStore(deps);
  await recheckPremium(deps);
  return unsubscribe;
}

export async function buyPremium(deps: PremiumServiceDeps): Promise<void> {
  deps.dispatch({ type: 'buy-tapped' });
  await deps.port.requestPurchase(deps.productId); // outcome arrives via subscribe()
}
```

Wiring and timing:
- `startPremium` runs once after the splash (never blocking it). Offline, it ends in `store-unavailable` quickly; the cached `isPremium` from the save already controls ads.
- When `ConnectivityPort` reports online and the flow is `unavailable`, call `loadStore(deps)` again. On `AppState` → `active`, call `recheckPremium(deps)` if online.
- `persistPremium({ isPremium: true })` writes docs/06's `premium` section (`owned: true`, `revokedAtMs: null`) in a synchronous SQLite transaction; `{ isPremium: false, revokedAtMs }` writes `owned: false` with the date, which docs/06's `keepPremiumUnlessRevoked` guard requires (a revoke without a date is ignored). "Reset all progress" never touches that section; a save restored from backup keeps it; device backup (D5) carries it to a new phone, where the launch re-check or Restore confirms it.
- A revoked purchase (a refund; Family Sharing stays off, FINAL H.3, so no family removal can occur) turns ads back on at the next re-check. The harness showed that after a refund the relaunched app got **no** listener update, but `Transaction.all` carried `revocationDateIOS`; the launch re-check is therefore the path that catches refunds.
- The Premium page never shows a store error text from Apple; only the catalog messages in section 3.4.

### 3.6 Price display

```ts
// packages/shell/src/services/purchase/format-store-price.ts
import type { StoreProduct } from './purchase-port.ts';

// Price exactly as the store sells it (currency and amount), shown in the player's digits.
// Falls back to the store's own string when it gives no numeric price. Never typed in code.
export function formatStorePrice(product: StoreProduct, localeTag: string): string {
  if (product.price === null) return product.displayPrice;
  try {
    const format = new Intl.NumberFormat(localeTag, {
      style: 'currency',
      currency: product.currency,
    });
    return format.format(product.price);
  } catch {
    return product.displayPrice; // unknown currency code
  }
}
```

With the forced Intl polyfills (`docs/10`) and the StoreKit value `1.9899999999999998` EUR: `en` → `€1.99`, `de` → `1,99 €`, `ckb-u-nu-arabext` → `€ ۱٫۹۹` (the separator is a no-break space U+00A0), `fa-u-nu-arabext` → `€۱٫۹۹` preceded by a left-to-right mark. `formatPrice` in the service deps is `(product) => formatStorePrice(product, localeTagFor(language, digits))`; the formatted string goes into `premium.buy-button` as `{priceText}`, which `t()` isolates (FSI/PDI).

### 3.7 Pricing and Family Sharing

- **Price (D3, decided 2026-09-30: €1.99, FINAL H.2).** €1.99 in the base territory Germany (`DEU`), an App Store price point; Apple equalises other territories. The script looks the point up and uses it; if the product somehow has no exact €1.99 point, it stops and lists the nearest points instead of guessing. The app never shows this number itself: it shows the store's localised `displayPrice` (rule 13). The price can be changed later in App Store Connect without an app update.
- **Family Sharing: off (decided 2026-09-30, FINAL H.3).** `familySharable: false` is fixed in the API body, `"familyShareable" : false` in the StoreKit configuration, and the web-UI steps say to leave it off (rule 19). Apple cannot turn it off again once it is on. The evidence rule would still handle a family revocation like a refund, but with sharing off none can occur.
- The Settings row reads "Remove ads – {priceText}" with the store price, or "Premium – active".

### 3.8 Testing tiers

#### Tier 1: Jest (every commit)

`createFakePurchase` (docs/03 naming: `fake-purchase.ts` → `createFakePurchase`) scripts the store; the reducer, the evidence rule and the service are tested without any native code.

```ts
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
```

```ts
// packages/shell/src/stores/premium/premium-reducer.test.ts
import { premiumReducer } from './premium-reducer.ts';
import { initialPremiumState } from './premium-state.ts';
import { premiumView } from './premium-view.ts';

import type { PremiumAction, PremiumState } from './premium-state.ts';

const PRICE = '€1.99';

function run(actions: readonly PremiumAction[], isPremium = false): PremiumState {
  return actions.reduce(premiumReducer, initialPremiumState(isPremium));
}

const READY: readonly PremiumAction[] = [{ type: 'price-loaded', price: PRICE }];
const BUYING: readonly PremiumAction[] = [...READY, { type: 'buy-tapped' }];

describe('premiumReducer maps every S12 state', () => {
  it.each([
    ['loading-price', []],
    ['store-unavailable', [{ type: 'store-unavailable' }]],
    ['ready', READY],
    ['purchase-in-progress', BUYING],
    ['pending', [...BUYING, { type: 'purchase-failed', failure: 'deferred' }]],
    ['pending', [...BUYING, { type: 'purchase-pending' }]],
    ['success', [...BUYING, { type: 'premium-granted' }]],
    ['ready', [...BUYING, { type: 'purchase-failed', failure: 'cancelled' }]],
    ['error', [...BUYING, { type: 'purchase-failed', failure: 'failed' }]],
    ['store-unavailable', [...BUYING, { type: 'purchase-failed', failure: 'unavailable' }]],
    ['restoring', [...BUYING, { type: 'purchase-failed', failure: 'already-owned' }]],
    [
      'restore-empty',
      [...READY, { type: 'restore-tapped' }, { type: 'restore-finished', evidence: 'unknown' }],
    ],
    [
      'restore-failed',
      [...READY, { type: 'restore-tapped' }, { type: 'restore-finished', evidence: 'sync-failed' }],
    ],
    [
      'already-owned',
      [...READY, { type: 'restore-tapped' }, { type: 'restore-finished', evidence: 'owned' }],
    ],
  ] as const)('reaches %s', (view, actions) => {
    expect(premiumView(run(actions))).toBe(view);
  });

  it('shows the thank-you once, then "Premium - active"', () => {
    const state = run([...BUYING, { type: 'premium-granted' }, { type: 'thanks-shown' }]);
    expect(premiumView(state)).toBe('already-owned');
  });

  it('ignores a duplicated failure (iOS rejects AND emits on the error listener)', () => {
    const once = run([...BUYING, { type: 'purchase-failed', failure: 'deferred' }]);
    const twice = premiumReducer(once, { type: 'purchase-failed', failure: 'failed' });
    expect(premiumView(twice)).toBe('pending');
  });

  it('keeps Premium when the silent re-check finds no evidence', () => {
    const state = run([{ type: 'entitlements-checked', evidence: 'unknown' }], true);
    expect(state.isPremium).toBe(true);
  });

  it('revokes Premium only on explicit revocation evidence', () => {
    expect(run([{ type: 'entitlements-checked', evidence: 'revoked' }], true).isPremium).toBe(
      false,
    );
  });

  it('ignores BUY while offline or already Premium', () => {
    expect(premiumView(run([{ type: 'store-unavailable' }, { type: 'buy-tapped' }]))).toBe(
      'store-unavailable',
    );
    expect(run([...READY, { type: 'buy-tapped' }], true).flow.kind).toBe('ready');
  });
});
```

```ts
// packages/shell/src/services/purchase/premium-service.test.ts
import { flushMicrotasks } from '@e07/shell/testing/flush-microtasks.ts';

import { createFakePurchase } from './fake-purchase.ts';
import { restorePremium } from './premium-service.ts';
import { buyPremium, startPremium } from './premium-store-flow.ts';

import type { FakePurchaseScript } from './fake-purchase.ts';
import type { PremiumChange } from './premium-service.ts';
import type { StoreTransaction } from './purchase-port.ts';
import type { PremiumAction } from '@e07/shell/stores/premium/premium-state.ts';

const ID = 'io.applander.linesiege.premium';
const BOUGHT: StoreTransaction = {
  productId: ID,
  transactionId: 't1',
  state: 'purchased',
  revocationDateMs: null,
  handle: null,
};

function setup(overrides: Partial<FakePurchaseScript> = {}) {
  const script: FakePurchaseScript = {
    isConnected: true,
    product: { productId: ID, displayPrice: '€1.99', price: 1.99, currency: 'EUR' },
    restoreResult: 'synced',
    transactions: [],
    calls: [],
    ...overrides,
  };
  const port = createFakePurchase(script);
  const actions: PremiumAction[] = [];
  const deps = {
    port,
    productId: ID,
    dispatch: (action: PremiumAction) => actions.push(action),
    persistPremium: (change: PremiumChange) =>
      script.calls.push(`persist:${String(change.isPremium)}`),
    formatPrice: (product: { readonly displayPrice: string }) => product.displayPrice,
    onError: () => undefined,
  };
  return { script, port, actions, deps };
}

describe('premium service', () => {
  it('persists Premium BEFORE finishing the transaction', async () => {
    const { script, port, deps } = setup();
    await startPremium(deps);
    await buyPremium(deps);
    port.emit({ type: 'transaction', transaction: BOUGHT });
    await flushMicrotasks();
    const tail = script.calls.slice(script.calls.indexOf('requestPurchase'));
    expect(tail).toStrictEqual(['requestPurchase', 'persist:true', 'finish:t1']);
  });

  it('maps an empty product list to "store unavailable"', async () => {
    const { actions, deps } = setup({ product: null });
    await startPremium(deps);
    expect(actions).toContainEqual({ type: 'store-unavailable' });
  });

  it('reports a failed App Store sync as "couldn\'t restore", not "nothing to restore"', async () => {
    const { actions, deps } = setup({ restoreResult: 'sync-failed' });
    await restorePremium(deps);
    expect(actions).toContainEqual({ type: 'restore-finished', evidence: 'sync-failed' });
  });

  it('keeps Premium when the launch re-check sees no transactions', async () => {
    const { script, deps } = setup({ transactions: [] });
    await startPremium(deps);
    expect(script.calls).not.toContain('persist:false');
  });

  it('revokes on a refunded transaction delivered by the listener', async () => {
    const refunded = { ...BOUGHT, revocationDateMs: 1_700_000_000_000 };
    const { script, port, deps } = setup({ transactions: [refunded] });
    await startPremium(deps);
    port.emit({ type: 'transaction', transaction: refunded });
    await flushMicrotasks();
    expect(script.calls).toContain('persist:false');
  });
});
```

Also in Tier 1: `entitlement-evidence.test.ts` (absence → `unknown`; refund → `revoked`; newer purchase after refund → `owned`; other products ignored) and `format-store-price.test.ts` (the outputs in section 3.6). A root mock `__mocks__/expo-iap.ts` exports no-op versions of the functions the adapter imports, so importing the adapter in a test never touches native code; Shell tests use the fake.

#### Tier 2: the hosted-XCTest StoreKit harness (verified)

What was found (Xcode 26.6, iOS 26.5 simulator):
- `SKTestSession` created in an **XCUITest runner** does not control the app under test, and a StoreKit configuration referenced from the scheme is not applied by `xcodebuild test`.
- A **hosted unit-test bundle** (`TEST_HOST` = the app) that creates `SKTestSession(configurationFileNamed: "Premium")` inside the app process arms the simulator's StoreKit test environment for that bundle ID. The setting persists on that simulator, so the app launched afterwards by `xcrun simctl launch` (or Maestro) buys from the local `.storekit` file.
- **The app must carry `get-task-allow`.** Without it, storekitd logs "not installed for development", `SKTestSession` logs `SKInternalErrorDomain Code=3`, and products come back empty, silently.
- Verified today **with a React Native app using expo-iap 5.8.0**, in both a Release simulator build and a **Debug** build with Metro running (the Debug-only entitlement required by FINAL 26): product `€1.99` / `1.9899999999999998 EUR`; purchase without any dialog → update `purchased` → `finishTransaction`; Ask to Buy → `deferred-payment` (rejection + listener) → approve → the next launch received the purchase; refund → the next launch saw `revocationDateIOS` in `Transaction.all` and an empty active list, with no listener event; fail mode → code `unknown`; `restorePurchases` after a purchase → success and the purchase listed.
- Not testable in Tier 2: restore after reinstall (uninstalling the app cleared the test transactions) and a player-cancelled purchase sheet (dialogs are disabled). Tier 1 and Tier 3 cover both.
- Once, after a reinstall, the simulated "Sign in with Apple Account … [Environment: Xcode]" alert appeared during a StoreKit call; Maestro `tapOn: "OK"` (or `"Cancel"`) dismisses it.

Files (all in `packages/tooling/src/storekit/`):

`Premium.storekit.template` (StoreKit configuration v2.0, accepted by Xcode 26.6; `__PRODUCT_ID__` becomes `<bundleId>.premium`):

```json
{
  "identifier" : "E07PREMIUM",
  "nonRenewingSubscriptions" : [ ],
  "products" : [
    {
      "displayPrice" : "1.99",
      "familyShareable" : false,
      "internalID" : "900000001",
      "localizations" : [ { "description" : "No ads, ever.", "displayName" : "Premium", "locale" : "en_US" } ],
      "productID" : "__PRODUCT_ID__",
      "referenceName" : "Premium",
      "type" : "NonConsumable"
    }
  ],
  "settings" : { "_failTransactionsEnabled" : false, "_locale" : "en_US", "_storefront" : "DEU", "_storeKitErrors" : [ ] },
  "subscriptionGroups" : [ ],
  "version" : { "major" : 2, "minor" : 0 }
}
```

Rule 19's checks (FINAL H.2 and H.3) live in the premium-purchase skill's checker `check-premium`, not in a repo file (corrected on 2026-10-01, FINAL H.20, L14; an earlier draft here proposed a separate repo checker in `packages/tooling/src/storekit/` with a unit test, which was never built). Its rules: `storekit-config` (valid JSON with exactly one NonConsumable product, `<bundleId>.premium` once generated), `family-sharing` (`"familyShareable" : false` in the template and in every generated `apps/<id>/ios/*.storekit`, and `familySharable: false` in the App Store Connect payloads) and `price-target` (`"displayPrice" : "1.99"` and the product script's `TARGET_EUR`, owner decision O2). The harness copies the checked template into `Premium.storekit` unchanged apart from the product ID, so it runs no check of its own. Verified on 2026-10-01: on the round-4 game clean-room repo (Line Siege, `io.applander.linesiege`) the three rules report nothing.

`storekit-harness.entitlements` (copied to `ios/<App>/`, referenced by the app's **Debug** configuration only):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>get-task-allow</key>
	<true/>
</dict>
</plist>
```

`ArmTests.swift` (the hosted tests; each one arms or acts on the simulator's test store):

```swift
// packages/tooling/src/storekit/ArmTests.swift
// Hosted XCTest (TEST_HOST = the app): runs SKTestSession inside the app process to arm the
// simulator StoreKit test environment for the app bundle id. Verified 2026-09-26 (Xcode 26.6).
import XCTest
import StoreKitTest

final class ArmTests: XCTestCase {
  func testArmDefault() throws {
    let s = try SKTestSession(configurationFileNamed: "Premium")
    s.disableDialogs = true
    s.clearTransactions()
    s.askToBuyEnabled = false
    s.failTransactionsEnabled = false
    s.resetToDefaultState()
    s.disableDialogs = true
    s.clearTransactions()
    print("SKSPIKE ARM default fail=\(s.failTransactionsEnabled) ask=\(s.askToBuyEnabled)")
  }
  func testArmAskToBuy() throws {
    let s = try SKTestSession(configurationFileNamed: "Premium")
    s.disableDialogs = true
    s.clearTransactions()
    s.askToBuyEnabled = true
    print("SKSPIKE ARM asktobuy")
  }
  func testArmFail() throws {
    let s = try SKTestSession(configurationFileNamed: "Premium")
    s.disableDialogs = true
    s.clearTransactions()
    s.failTransactionsEnabled = true
    print("SKSPIKE ARM fail")
  }
  func testApproveAll() throws {
    let s = try SKTestSession(configurationFileNamed: "Premium")
    let txs = s.allTransactions()
    print("SKSPIKE APPROVE txs=\(txs.map { "\($0.identifier) pending=\($0.pendingAskToBuyConfirmation) state=\($0.state.rawValue)" })")
    for t in txs where t.pendingAskToBuyConfirmation { try s.approveAskToBuyTransaction(identifier: t.identifier) }
    s.askToBuyEnabled = false
  }
  func testRefundAll() throws {
    let s = try SKTestSession(configurationFileNamed: "Premium")
    let txs = s.allTransactions()
    print("SKSPIKE REFUND txs=\(txs.map { "\($0.identifier) state=\($0.state.rawValue)" })")
    for t in txs { try s.refundTransaction(identifier: t.identifier) }
  }
}
```

Setting `failTransactionsEnabled = false` alone did not leave fail mode; `testArmDefault` calls `resetToDefaultState()` for that. `failTransactionsEnabled` is deprecated since iOS 17 ("Use simulatedError(forAPI:)", Xcode 26.6 `SKTestSession.h`), so Xcode prints a warning, but it still worked on iOS 26.5. If it stops working, `testArmFail` becomes `try await s.setSimulatedError(.generic(.unknown), forAPI: .purchase)` (not verified).

`add-harness.rb` (adds the target to a freshly prebuilt project; idempotent; uses the `xcodeproj` gem that ships with CocoaPods, 1.25.0 on this Mac):

```ruby
# packages/tooling/src/storekit/add-harness.rb
# Usage: ruby add-harness.rb <ios-dir> <AppTarget> <bundle-id>
# Adds the hosted StoreKit test target to a freshly prebuilt ios/ project (test variant only).
# Uses the xcodeproj gem that ships with CocoaPods. Idempotent: exits early if already added.
require 'xcodeproj'

ios_dir, app_name, bundle_id = ARGV
abort('usage: add-harness.rb <ios-dir> <AppTarget> <bundle-id>') unless ios_dir && app_name && bundle_id
project_path = File.join(ios_dir, "#{app_name}.xcodeproj")
project = Xcodeproj::Project.open(project_path)
exit 0 if project.targets.any? { |t| t.name == 'StoreKitHarness' }
app = project.targets.find { |t| t.name == app_name } or abort("no target #{app_name}")

storekit = project.main_group.new_file('Premium.storekit') # file sits in <ios-dir>/
app.add_resources([storekit])

harness = project.new_target(:unit_test_bundle, 'StoreKitHarness', :ios, '16.4')
group = project.main_group.new_group('StoreKitHarness', 'StoreKitHarness')
harness.add_file_references([group.new_file('ArmTests.swift')])
harness.add_resources([storekit])
harness.add_dependency(app)
harness.build_configurations.each do |config|
  s = config.build_settings
  s['PRODUCT_NAME'] = '$(TARGET_NAME)'
  s['PRODUCT_BUNDLE_IDENTIFIER'] = "#{bundle_id}.storekit-harness"
  s['GENERATE_INFOPLIST_FILE'] = 'YES'
  s['SWIFT_VERSION'] = '5.0'
  s['TEST_HOST'] = "$(BUILT_PRODUCTS_DIR)/#{app_name}.app/#{app_name}"
  s['BUNDLE_LOADER'] = '$(TEST_HOST)'
  s['CODE_SIGN_STYLE'] = 'Manual'
  s['CODE_SIGN_IDENTITY'] = '-'
end
# get-task-allow in DEBUG ONLY: without it storekitd ignores the SKTestSession (SKInternalErrorDomain 3).
app.build_configurations.each do |config|
  next unless config.name == 'Debug'
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = "#{app_name}/storekit-harness.entitlements"
end
project.save

scheme_path = File.join(project_path, 'xcshareddata', 'xcschemes', "#{app_name}.xcscheme")
scheme = Xcodeproj::XCScheme.new(scheme_path)
scheme.add_test_target(harness)
scheme.save!
puts "StoreKitHarness added to #{project_path}"
```

`PRODUCT_NAME = $(TARGET_NAME)` is required: without it the build fails with "Multiple commands produce …/PlugIns/.xctest" (verified).

`storekit-harness.ts` is the Tier-2 runner. It prebuilds and builds the harness, starts Metro, and then, for each scenario in order, arms the store and runs one Maestro flow. The file below is the one the Shell ships (corrected to it on 2026-10-01, FINAL H.20, L14): it takes `--device <udid>`, gives Metro and every Maestro run a port of their own, and builds each Maestro call with `maestroGlobalArgs()` (docs/07), so no call can reach another session's simulator. It is a CLI of its own because docs/07's `e2e:ios` runner neither arms the store nor builds Debug:

```ts
// packages/tooling/src/storekit/storekit-harness.ts
// Tier-2 Premium purchase tests on a throwaway simulator of your own. Test variant only.
// Usage: node packages/tooling/src/storekit/storekit-harness.ts --app <game-id> --device <udid>
//          [--driver-port <n>] [--metro-port <n>]
// Prebuilds a harness project, builds it (Debug) against its own Metro port, starts Metro, then
// per scenario arms the simulator's StoreKit test store and runs one flow from
// packages/shell/e2e/storekit/. Every Maestro call names the simulator and its own XCTest driver
// port (maestro-args.ts: a free port for each flow unless --driver-port is given), so no call can
// reach another session's simulator. Release-day
// order: the E2E evidence run, then this harness, then `xcrun simctl delete <udid>`, then
// `npx expo prebuild --clean` before any Release or store build (they share apps/<id>/ios).
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { availableParallelism, loadavg } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { driverPortFor, maestroGlobalArgs, maestroRunLine } from '@e07/tooling/e2e/maestro-args.ts';
import { busyNote } from '@e07/tooling/storekit/busy-note.ts';

import type { MaestroTarget } from '@e07/tooling/e2e/maestro-args.ts';

const HERE = import.meta.dirname;
const ROOT = process.cwd();
const TEST_ENV = {
  ...process.env,
  APP_VARIANT: 'test',
  EXPO_PUBLIC_APP_VARIANT: 'test',
  ADS_MODE: 'off',
};
// [arm test or null, flow]. Order matters: refund needs the purchase, approval the pending one.
const SCENARIOS: readonly (readonly [string | null, string])[] = [
  ['testArmDefault', '01-buy.yaml'],
  ['testRefundAll', '02-refund-relaunch.yaml'],
  ['testArmAskToBuy', '03-ask-to-buy.yaml'],
  ['testApproveAll', '04-approval-relaunch.yaml'],
  ['testArmDefault', '05-restore.yaml'],
  ['testArmFail', '06-failure.yaml'],
  [null, '07-store-unavailable.yaml'],
];

type Harness = {
  readonly appDir: string;
  readonly udid: string;
  /** This run's Metro port, built into the Debug app (RCT_METRO_PORT) and passed to expo start. */
  readonly metroPort: number;
  readonly scheme: string; // Xcode scheme = app target name
  readonly bundleId: string;
  readonly urlScheme: string; // for the debug deep link
};

function run(command: string, args: readonly string[], cwd: string): void {
  execFileSync(command, args, { cwd, env: TEST_ENV, stdio: 'inherit' });
}

function bundleIdOf(appDir: string): string {
  const json = execFileSync('npx', ['expo', 'config', '--json', '--type', 'public'], {
    cwd: appDir,
    env: TEST_ENV,
    encoding: 'utf8',
  });
  const id = (JSON.parse(json) as { ios?: { bundleIdentifier?: string } }).ios?.bundleIdentifier;
  if (id === undefined) throw new Error('no ios.bundleIdentifier');
  return id;
}

function urlSchemeOf(ios: string, scheme: string): string {
  const key = 'CFBundleURLTypes.0.CFBundleURLSchemes.0';
  const plist = join(ios, scheme, 'Info.plist');
  return execFileSync('plutil', ['-extract', key, 'raw', plist], { encoding: 'utf8' }).trim();
}

// Fresh CNG project (test variant) + harness files + target. Never used for shipped builds.
function prepareHarness(appDir: string, udid: string, metroPort: number): Harness {
  run('npx', ['expo', 'prebuild', '--platform', 'ios', '--clean'], appDir);
  const ios = join(appDir, 'ios');
  const scheme = readdirSync(ios)
    .find((f) => f.endsWith('.xcworkspace'))
    ?.replace('.xcworkspace', '');
  if (scheme === undefined) throw new Error('no .xcworkspace after prebuild');
  const bundleId = bundleIdOf(appDir);
  const template = readFileSync(join(HERE, 'Premium.storekit.template'), 'utf8');
  writeFileSync(
    join(ios, 'Premium.storekit'),
    template.replace('__PRODUCT_ID__', `${bundleId}.premium`),
  );
  mkdirSync(join(ios, 'StoreKitHarness'), { recursive: true });
  copyFileSync(join(HERE, 'ArmTests.swift'), join(ios, 'StoreKitHarness', 'ArmTests.swift'));
  copyFileSync(
    join(HERE, 'storekit-harness.entitlements'),
    join(ios, scheme, 'storekit-harness.entitlements'),
  );
  run('ruby', [join(HERE, 'add-harness.rb'), ios, scheme, bundleId], appDir);
  return { appDir, udid, metroPort, scheme, bundleId, urlScheme: urlSchemeOf(ios, scheme) };
}

function xcodebuild(h: Harness, action: readonly string[]): void {
  const common = ['-workspace', `${h.scheme}.xcworkspace`, '-scheme', h.scheme];
  const target = ['-configuration', 'Debug', '-destination', `id=${h.udid}`];
  const derived = ['-derivedDataPath', '../build/storekit'];
  // A Debug app loads its JS from Metro on RCT_METRO_PORT (8081 unless set): this run's own port.
  execFileSync('xcodebuild', [...action, ...common, ...target, ...derived], {
    cwd: join(h.appDir, 'ios'),
    env: { ...TEST_ENV, RCT_METRO_PORT: String(h.metroPort) },
    stdio: 'inherit',
  });
}

// testArmDefault | testArmAskToBuy | testArmFail | testApproveAll | testRefundAll
function arm(h: Harness, test: string): void {
  xcodebuild(h, ['test-without-building', `-only-testing:StoreKitHarness/ArmTests/${test}`]);
}

// Debug builds load JS from Metro (localhost only; tooling may use fetch).
async function startMetro(appDir: string, port: number): Promise<() => void> {
  const env = { ...TEST_ENV, CI: '1', EXPO_NO_TELEMETRY: '1' };
  const metro = spawn('npx', ['expo', 'start', '--port', String(port)], { cwd: appDir, env });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const status = await fetch(`http://localhost:${String(port)}/status`).then(
      async (response) => response.text(),
      () => '',
    );
    if (status === 'packager-status:running') return () => metro.kill();
    await sleep(1000);
  }
  metro.kill();
  throw new Error(`Metro did not start on port ${String(port)}`);
}

// Before the run and after a failed one: is the Mac too busy for StoreKit's test store?
function busyNoteNow(): string | null {
  const [load = 0] = loadavg();
  return busyNote(load, availableParallelism());
}

// One Maestro run: the global --device and its own driver port (a free one for each flow, or the
// port a session passes with --driver-port).
async function runFlow(h: Harness, givenPort: string | undefined, flow: string): Promise<boolean> {
  const target: MaestroTarget = { udid: h.udid, driverPort: await driverPortFor(givenPort) };
  const maestro = join(ROOT, 'tools', 'maestro', 'bin', 'maestro'); // the pinned Maestro install
  const file = join(ROOT, 'packages', 'shell', 'e2e', 'storekit', flow);
  const vars = ['-e', `APP_ID=${h.bundleId}`, '-e', `APP_SCHEME=${h.urlScheme}`];
  const env = {
    ...process.env, // JAVA_HOME must point at Java 17 (Maestro 2.10)
    MAESTRO_CLI_NO_ANALYTICS: 'true',
    MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true',
    MAESTRO_DISABLE_UPDATE_CHECK: 'true',
  };
  const command = ['test', file, ...vars];
  console.error(maestroRunLine(target, command));
  const args = [...maestroGlobalArgs(target), ...command];
  return spawnSync(maestro, args, { stdio: 'inherit', env }).status === 0;
}

async function main(argv: readonly string[]): Promise<number> {
  const valueOf = (flag: string): string | undefined =>
    argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined;
  const game = valueOf('--app');
  const udid = valueOf('--device');
  if (game === undefined || udid === undefined) {
    throw new Error('usage: storekit-harness.ts --app <game-id> --device <udid>');
  }
  // Refuse a non-UDID or a bad --driver-port before anything is built; each flow then gets its own
  // driver port (runFlow).
  const givenPort = valueOf('--driver-port');
  maestroGlobalArgs({ udid, driverPort: await driverPortFor(givenPort) });
  const metroPort = await driverPortFor(valueOf('--metro-port')); // any free port serves Metro too
  const busy = busyNoteNow();
  if (busy !== null) console.error(busy);
  const h = prepareHarness(join(ROOT, 'apps', game), udid, metroPort);
  xcodebuild(h, ['build-for-testing', '-sdk', 'iphonesimulator']);
  const stopMetro = await startMetro(h.appDir, metroPort);
  let failures = 0;
  for (const [test, flow] of SCENARIOS) {
    if (test !== null) arm(h, test);
    if (!(await runFlow(h, givenPort, flow))) failures += 1;
  }
  stopMetro();
  console.error(`storekit: ${String(failures)} of ${String(SCENARIOS.length)} scenario(s) failed`);
  const busyAtEnd = failures > 0 ? busyNoteNow() : null;
  if (busyAtEnd !== null) console.error(busyAtEnd);
  return failures === 0 ? 0 : 1;
}

process.exitCode = await main(process.argv.slice(2));
```

The equivalent shell commands (what was run by hand on 2026-09-26):

```sh
UDID=$(xcrun simctl create e07-storekit-tier2 "iPhone 17 Pro" com.apple.CoreSimulator.SimRuntime.iOS-26-5)   # docs/14 rule 14: e07-<purpose>
xcrun simctl boot "$UDID"
# after prepareHarness (prebuild + files + add-harness.rb):
cd apps/line-siege/ios
xcodebuild build-for-testing -workspace LineSiege.xcworkspace -scheme LineSiege \
  -configuration Debug -sdk iphonesimulator -destination id=$UDID -derivedDataPath ../build/storekit
(cd .. && CI=1 npx expo start --port 8081 &)            # Debug build loads JS from Metro
xcodebuild test-without-building -workspace LineSiege.xcworkspace -scheme LineSiege \
  -configuration Debug -destination id=$UDID -derivedDataPath ../build/storekit \
  -only-testing:StoreKitHarness/ArmTests/testArmDefault
xcrun simctl launch "$UDID" <bundleId>                  # or a Maestro flow (below)
xcrun simctl spawn "$UDID" log show --last 2m --info --debug --style compact \
  --predicate 'process == "LineSiege" AND eventMessage CONTAINS "[premium]"'
xcrun simctl delete "$UDID"                              # the test store persists per simulator
```

Scenarios, in the order the runner uses (each flow opens S12 through docs/07's debug deep link and asserts by `testID`). The flows live in `packages/shell/e2e/storekit/`, outside `e2e/flows/`, so `npm run e2e:ios` never runs them against an unarmed Release build. Harness builds use `ADS_MODE=off`, so the flows check Premium states, not banners:

| Flow | Arm | Deep-link query and UI steps | Expected |
|---|---|---|---|
| `01-buy.yaml` | `testArmDefault` | `firstRun=0&premium=0&screen=premium`, tap `premium.buy-button` | `premium.state.success` |
| `02-refund-relaunch.yaml` | `testRefundAll` | relaunch, `screen=premium` | `premium.buy-button` (Premium off after the launch re-check) |
| `03-ask-to-buy.yaml` | `testArmAskToBuy` | `premium=0&screen=premium`, tap `premium.buy-button` | `premium.state.pending` |
| `04-approval-relaunch.yaml` | `testApproveAll` | relaunch, `screen=premium` | `premium.state.owned`, without any tap |
| `05-restore.yaml` | `testArmDefault` | `premium=0&screen=premium`, buy, `premium=0` again, tap `premium.restore-button` | `premium.state.owned` |
| `06-failure.yaml` | `testArmFail` | `premium=0&screen=premium`, tap `premium.buy-button` | `premium.state.error` |
| `07-store-unavailable.yaml` | none | `premium=0&offline=1&screen=premium` | `premium.state.unavailable` |

```yaml
# packages/shell/e2e/storekit/01-buy.yaml — Tier 2 (docs/12). Run only by storekit-harness.ts,
# right after testArmDefault; outside e2e/flows/, so the normal E2E run never picks it up.
appId: ${APP_ID}
name: Premium purchase completes in the armed StoreKit test store
tags: [storekit]
---
- launchApp
- runFlow:
    file: ../subflows/debug-setup.yaml
    env:
      QUERY: 'firstRun=0&premium=0&screen=premium'
      WAIT_FOR: 'premium.screen'
- tapOn:
    id: 'premium.buy-button'
- extendedWaitUntil:
    visible:
      id: 'premium.state.success'
    timeout: 15000
```

The relaunch flows start with `- launchApp` as well (Maestro stops the app first) and pass only `screen=premium`, so the cached Premium from the previous flow is what the re-check must change. Do not use `launchApp: { clearState: true }` here: uninstalling the app cleared the test transactions in the harness run, and `clearState` may reinstall.

Harness builds are never uploaded: they are Debug simulator builds from a separate prebuild. The next normal build starts with `npx expo prebuild --platform ios --clean` (`docs/14`), which removes the harness target, the `.storekit` file and the Debug entitlement. `docs/14`'s store-artifact gate still asserts that no `*.storekit`, no `*.xctest` and no `get-task-allow` is in the IPA.

#### Tier 3: the owner on TestFlight (once per game, and after an expo-iap upgrade)

Human step G6 in `docs/14`: install the TestFlight build, open Premium, buy (sandbox, not charged), check the ads are gone; delete and reinstall the app, tap Restore, check Premium returns; start a purchase and cancel it (the page returns quietly). This is the only test of the real App Store sheet, the Apple Account prompt and restore after reinstall. Changes to product metadata can take up to an hour to reach the sandbox.

### 3.9 Offline and edge cases

| Case | Behaviour |
|---|---|
| Premium owned, offline | ads off (cached), S12 shows "Premium – active", Restore link shows `premium.store-unavailable` if tapped |
| Not owned, offline | S12 `store-unavailable`, BUY disabled; hints/continues follow `perkOffer` (`docs/11`) |
| Purchase sheet open, app killed | StoreKit keeps the transaction; at next launch the listener delivers it → saved → finished |
| Crash between save and finish | re-delivered at next launch; `persistPremium({ isPremium: true })` again is harmless |
| Ask to Buy approved while the app is closed | delivered at next launch; `didJustPurchase` stays false (no thank-you out of context) |
| Refund | detected by the launch/foreground re-check (`Transaction.all` revocation date); ads return |
| Clock changes | irrelevant: no dates are compared on our side |
| Reset all progress | Premium kept (`premium` section) |
| Save restored from backup | Premium from the `premium` section; the re-check confirms it |
| New phone (device backup, D5) | save restored with Premium; re-check confirms; otherwise Restore |

### 3.10 Creating the product with the App Store Connect API

The API can create the in-app purchase, its localizations, price schedule, availability, review screenshot and submission; it cannot create the app record (human step G2 in `docs/14`). The script builds on `docs/14`'s `asc-jwt.ts`, `asc-credentials.ts` and `asc-client.ts` (`ASC_KEY_ID`, `ASC_ISSUER_ID`; the `.p8` is read only into memory).

```ts
// packages/tooling/src/asc/premium-iap-payloads.ts
// Pure request bodies for the Premium in-app purchase (App Store Connect API v1/v2).
export type PricePoint = { readonly id: string; readonly customerPrice: number };

const rel = (type: string, id: string): { data: { type: string; id: string } } => ({
  data: { type, id },
});

export function createIapBody(appId: string, productId: string): unknown {
  return {
    data: {
      type: 'inAppPurchases',
      attributes: {
        name: 'Premium', // reference name, max 64 chars, never shown to players
        productId, // letters, digits, '.', '-', '_'; max 100; never reusable in this app
        inAppPurchaseType: 'NON_CONSUMABLE',
        familySharable: false, // always off (FINAL H.3); Apple: once on, it cannot be turned off
        reviewNote: 'Removes all ads. Restore purchase is on the Premium page and in Settings.',
      },
      relationships: { app: rel('apps', appId) },
    },
  };
}

// App Store Connect offers no Persian or Sorani localization: en-US and de-DE only.
// Display name 2-30 chars, description max 45 chars.
export const PREMIUM_LOCALIZATIONS = [
  { locale: 'en-US', name: 'Premium', description: 'No ads, ever. One-time purchase.' },
  { locale: 'de-DE', name: 'Premium', description: 'Nie wieder Werbung. Einmalkauf.' },
] as const;

export function localizationBody(iapId: string, index: number): unknown {
  const localization = PREMIUM_LOCALIZATIONS[index];
  if (localization === undefined) throw new Error(`no localization ${String(index)}`);
  return {
    data: {
      type: 'inAppPurchaseLocalizations',
      attributes: localization,
      relationships: { inAppPurchaseV2: rel('inAppPurchases', iapId) },
    },
  };
}

// Spec D3: EUR 1.99, an App Store price point (FINAL H.2). Returns the points closest first;
// the caller uses the exact match and stops (never guesses) when there is none.
export function closestPricePoints(points: readonly PricePoint[], target: number): PricePoint[] {
  return [...points].sort(
    (a, b) => Math.abs(a.customerPrice - target) - Math.abs(b.customerPrice - target),
  );
}

export function priceScheduleBody(iapId: string, pricePointId: string, territory: string): unknown {
  return {
    data: {
      type: 'inAppPurchasePriceSchedules',
      relationships: {
        inAppPurchase: rel('inAppPurchases', iapId),
        baseTerritory: rel('territories', territory), // required by Apple
        manualPrices: { data: [{ type: 'inAppPurchasePrices', id: '${price-0}' }] },
      },
    },
    included: [
      {
        type: 'inAppPurchasePrices',
        id: '${price-0}',
        attributes: { startDate: null },
        relationships: { inAppPurchasePricePoint: rel('inAppPurchasePricePoints', pricePointId) },
      },
    ],
  };
}

// POST /v1/inAppPurchaseAvailabilities: sell wherever the app is sold.
export function availabilityBody(iapId: string, territoryIds: readonly string[]): unknown {
  return {
    data: {
      type: 'inAppPurchaseAvailabilities',
      attributes: { availableInNewTerritories: true },
      relationships: {
        inAppPurchase: rel('inAppPurchases', iapId),
        availableTerritories: { data: territoryIds.map((id) => ({ type: 'territories', id })) },
      },
    },
  };
}

// Review screenshot: 1) POST reserve (this body), 2) PUT the bytes to each returned
// uploadOperation, 3) PATCH { uploaded: true, sourceFileChecksum: <md5 hex> }.
export function screenshotReserveBody(iapId: string, fileName: string, fileSize: number): unknown {
  return {
    data: {
      type: 'inAppPurchaseAppStoreReviewScreenshots',
      attributes: { fileName, fileSize },
      relationships: { inAppPurchaseV2: rel('inAppPurchases', iapId) },
    },
  };
}

export function screenshotCommitBody(screenshotId: string, md5Hex: string): unknown {
  return {
    data: {
      type: 'inAppPurchaseAppStoreReviewScreenshots',
      id: screenshotId,
      attributes: { uploaded: true, sourceFileChecksum: md5Hex },
    },
  };
}
```

`'${price-0}'` is a literal string: JSON:API "local ID" syntax that links `manualPrices` to the `included` price, not a template.

```ts
// packages/tooling/src/asc/create-premium-iap.ts
// Usage: node packages/tooling/src/asc/create-premium-iap.ts <bundleId> [--price <EUR>]
// Needs ASC_KEY_ID and ASC_ISSUER_ID (docs/14). Re-running is safe: it reuses the product, skips
// locales that exist, and posting a price schedule again replaces the schedule.
import { nowEpochSeconds } from '@e07/tooling/clock/system-clock.ts';

import { ascRequest } from './asc-client.ts';
import { loadAscCredentials } from './asc-credentials.ts';
import { createAscJwt } from './asc-jwt.ts';
import {
  createIapBody,
  localizationBody,
  closestPricePoints,
  PREMIUM_LOCALIZATIONS,
  priceScheduleBody,
} from './premium-iap-payloads.ts';

import type { AscRequest } from './asc-client.ts';
import type { PricePoint } from './premium-iap-payloads.ts';

type Resource = { readonly id: string; readonly attributes?: Record<string, unknown> };
type Call = (request: AscRequest) => Promise<unknown>;

const BASE_TERRITORY = 'DEU';
const TARGET_EUR = 1.99; // spec D3: EUR 1.99, an App Store price point (FINAL H.2)

function dataOf(json: unknown): Resource[] {
  const data: unknown = typeof json === 'object' && json !== null ? Reflect.get(json, 'data') : [];
  return (Array.isArray(data) ? data : [data]) as Resource[];
}

async function findOrCreate(call: Call, appId: string, productId: string): Promise<string> {
  const path = `/v1/apps/${appId}/inAppPurchasesV2?filter[productId]=${productId}`;
  const existing = dataOf(await call({ method: 'GET', path }))[0];
  if (existing !== undefined) return existing.id;
  const body = createIapBody(appId, productId);
  const created = dataOf(await call({ method: 'POST', path: '/v2/inAppPurchases', body }))[0];
  if (created === undefined) throw new Error('create returned no data');
  return created.id;
}

async function addMissingLocalizations(call: Call, iapId: string): Promise<void> {
  const path = `/v2/inAppPurchases/${iapId}/inAppPurchaseLocalizations`;
  const existing = dataOf(await call({ method: 'GET', path })).map((l) => l.attributes?.['locale']);
  for (const [index, localization] of PREMIUM_LOCALIZATIONS.entries()) {
    if (existing.includes(localization.locale)) continue;
    const body = localizationBody(iapId, index);
    await call({ method: 'POST', path: '/v1/inAppPurchaseLocalizations', body });
  }
}

// limit=8000 is the endpoint's maximum: one page holds every DEU price point.
async function pricePoints(call: Call, iapId: string): Promise<PricePoint[]> {
  const path = `/v2/inAppPurchases/${iapId}/pricePoints?filter[territory]=${BASE_TERRITORY}&limit=8000`;
  return dataOf(await call({ method: 'GET', path })).map((point) => ({
    id: point.id,
    customerPrice: Number(point.attributes?.['customerPrice']),
  }));
}

async function choosePricePoint(call: Call, iapId: string, wanted: number): Promise<PricePoint> {
  const ranked = closestPricePoints(await pricePoints(call, iapId), wanted);
  const best = ranked[0];
  if (best?.customerPrice === wanted) return best;
  const options = ranked
    .slice(0, 3)
    .map((p) => String(p.customerPrice))
    .join(', ');
  throw new Error(`EUR ${String(wanted)} is not a price point here. Nearest: ${options}`);
}

async function main(bundleId: string, priceEur: number, nowEpochSeconds: number): Promise<void> {
  const token = createAscJwt(loadAscCredentials(process.env), nowEpochSeconds);
  const call: Call = async (request) => {
    const response = await ascRequest(token, request);
    if (!response.ok) throw new Error(`${request.path}: ${JSON.stringify(response.errors)}`);
    return response.json;
  };
  const app = dataOf(
    await call({ method: 'GET', path: `/v1/apps?filter[bundleId]=${bundleId}` }),
  )[0];
  if (app === undefined) throw new Error(`no app record for ${bundleId}: human step G2`);
  const iapId = await findOrCreate(call, app.id, `${bundleId}.premium`);
  await addMissingLocalizations(call, iapId);
  const point = await choosePricePoint(call, iapId, priceEur);
  const body = priceScheduleBody(iapId, point.id, BASE_TERRITORY);
  await call({ method: 'POST', path: '/v1/inAppPurchasePriceSchedules', body });
  console.error(
    `Premium ${iapId}: EUR ${String(point.customerPrice)}; next: availability, screenshot`,
  );
}

const priceFlag = process.argv.indexOf('--price');
const priceEur = priceFlag > 0 ? Number(process.argv[priceFlag + 1]) : TARGET_EUR;
await main(process.argv[2] ?? '', priceEur, nowEpochSeconds());
```

Remaining steps, same client:

| Step | Endpoint | Body | Note |
|---|---|---|---|
| Availability | `POST /v1/inAppPurchaseAvailabilities` | `availabilityBody(iapId, territories)` | territory IDs from `GET /v1/territories` (all), `availableInNewTerritories: true` |
| Review screenshot | `POST /v1/inAppPurchaseAppStoreReviewScreenshots` → PUT parts → `PATCH /v1/inAppPurchaseAppStoreReviewScreenshots/{id}` | `screenshotReserveBody`, then `screenshotCommitBody` | the S12 simulator screenshot at an App Store screenshot size; "used for review only" |
| Submission | first IAP: **with the first app version** | — | Apple: "The first … non-consumable … In-App Purchase … must be submitted with a new app version." The owner selects Premium on the version page before "Submit for Review" (release step R5 in `docs/14`). Later IAPs could use `POST /v1/inAppPurchaseSubmissions` |

The schemas above were read from Apple's API reference JSON on 2026-09-26 (`InAppPurchaseV2CreateRequest` with `name`, `productId`, `inAppPurchaseType` ∈ {`CONSUMABLE`, `NON_CONSUMABLE`, `NON_RENEWING_SUBSCRIPTION`}, `familySharable`, `reviewNote`; price schedules require `baseTerritory`). The script has not run against the live API (it needs the owner's key); its first run is part of game 1's store step. Metadata changes can take up to an hour to reach the sandbox.

### 3.11 Human steps

- **O1 (once, `docs/14`)**: Paid Apps Agreement, tax and banking in App Store Connect. Without it, the product cannot be sold or reliably tested in TestFlight.
- **G2 (per game, `docs/14`)**: create the app record (no API).
- **P1 (per game, part of G4 in `docs/14`)**: nothing to decide any more: the price is €1.99 and Family Sharing stays off (FINAL H.2, H.3). The agent runs `create-premium-iap.ts`, or the owner creates the product in the web UI: Monetization → In-App Purchases → + → Non-Consumable, reference name "Premium", product ID `<bundleId>.premium` (for example `io.applander.linesiege.premium`), price €1.99 in Germany, and **leave Family Sharing off**.
- **R5 (first release)**: on the version page, add Premium under "In-App Purchases and Subscriptions" before submitting.
- **G6 (per game)**: the Tier-3 TestFlight purchase test (buy, cancel, reinstall + restore).
- **Later, Android**: a Play Console managed product with the same ID, license testers, and an internal test track (billing only works for Play-installed builds).

---

## 4. Checklist

- [ ] `expo-iap` is 5.8.0 (or a newer version that passed section 3.1's re-verification), plugin entry `'expo-iap'` with no options, imported only by the adapter.
- [ ] No banned API or plugin option anywhere (ESLint + `audit:network`).
- [ ] Product ID is `<bundleId>.premium` with an `io.applander.*` bundle ID, NON_CONSUMABLE, €1.99, `familySharable: false`; `check-premium` passes its `storekit-config`, `family-sharing` and `price-target` rules on the StoreKit template and every generated configuration.
- [ ] `startPremium` subscribes before connecting; an empty product list shows "store unavailable".
- [ ] A purchase saves Premium, updates ads at once, then finishes the transaction (Tier-1 test green).
- [ ] Pending shows "Waiting for approval"; an approval later turns Premium on without a tap.
- [ ] Restore distinguishes `restore-failed` from `restore-empty`.
- [ ] Revocation only on a revocation date; absence and errors keep Premium (tests green).
- [ ] Launch and foreground re-checks run only when online and never block UI.
- [ ] "Reset all progress" keeps Premium.
- [ ] The price comes from the store and uses the player's digits; S12 texts come from the catalogs in all four languages.
- [ ] Tier 1 green; Tier 2 scenarios pass on a throwaway simulator; Tier 3 done by the owner for this game/version.
- [ ] Store IPA contains no `*.storekit`, no `*.xctest`, no `get-task-allow` (`docs/14` gate).
- [ ] The product exists in App Store Connect with en-US/de-DE texts, price, availability and review screenshot, and is attached to the first version's submission.

---

## 5. Sources

- expo-iap on npm: https://registry.npmjs.org/expo-iap
- OpenIAP / expo-iap source: https://github.com/hyodotdev/openiap (`libraries/expo-iap/src/index.ts`, `src/utils/restorePurchases.ts`, `packages/apple/Sources/OpenIapModule.swift`)
- OpenIAP Expo setup: https://openiap.dev/docs/setup/expo
- OpenIAP testing guide: https://openiap.dev/docs/guides/testing
- Expo in-app purchases guide: https://docs.expo.dev/guides/in-app-purchases/
- StoreKit Test: https://developer.apple.com/documentation/storekittest
- SKTestSession: https://developer.apple.com/documentation/storekittest/sktestsession
- Setting up StoreKit testing in Xcode: https://developer.apple.com/documentation/xcode/setting-up-storekit-testing-in-xcode
- `Transaction.updates`: https://developer.apple.com/documentation/storekit/transaction/updates
- Testing in-app purchases with sandbox: https://developer.apple.com/documentation/storekit/testing-in-app-purchases-with-sandbox
- App Store Connect API, create an in-app purchase: https://developer.apple.com/documentation/appstoreconnectapi/post-v2-inapppurchases
- Price points / price schedules: https://developer.apple.com/documentation/appstoreconnectapi/get-v2-inapppurchases-_id_-pricepoints, https://developer.apple.com/documentation/appstoreconnectapi/post-v1-inapppurchasepriceschedules
- Localizations, availability, review screenshot, submission: https://developer.apple.com/documentation/appstoreconnectapi/post-v1-inapppurchaselocalizations, https://developer.apple.com/documentation/appstoreconnectapi/post-v1-inapppurchaseavailabilities, https://developer.apple.com/documentation/appstoreconnectapi/post-v1-inapppurchaseappstorereviewscreenshots, https://developer.apple.com/documentation/appstoreconnectapi/post-v1-inapppurchasesubmissions
- Uploading assets to App Store Connect: https://developer.apple.com/documentation/appstoreconnectapi/uploading-assets-to-app-store-connect
- Submit an in-app purchase: https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase
- In-App Purchase information (field rules): https://developer.apple.com/help/app-store-connect/reference/in-app-purchases-and-subscriptions/in-app-purchase-information
- Family Sharing for in-app purchases: https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/turn-on-family-sharing-for-in-app-purchases
- App Store localizations: https://developer.apple.com/help/app-store-connect/reference/app-information/app-store-localizations
- App Review Guidelines 3.1.1 (restore mechanism): https://developer.apple.com/app-store/review/guidelines/#in-app-purchase
- Google Play Billing deprecation schedule (Android later): https://developer.android.com/google/play/billing/deprecation-faq

---

## Verified

On 2026-09-26 (macOS, Node 26.4.0, Xcode 26.6 / iOS 26.5 simulator, Expo SDK 57.0.25, RN 0.86.3, Hermes 250829098.0.17):

- **Code** (re-checked by the reviewer in `scratchpad/rn/verify-services-i18n`). Every TypeScript file above compiled in docs/04's tsconfig layout against the real `expo-iap` 5.8.0 types. It passed docs/04's `eslint.config.mjs` plus docs/05's additions (`--max-warnings 0`) and Prettier 3.9.9. Jest (`jest-expo/ios` 57.0.5, docs/07's config and root mocks) ran the reducer, evidence, service, price and ASC-payload tests green, plus a probe that a refund reaches `persistPremium` with its newest `revokedAtMs`. The canonical config caught two problems, both fixed above: async `handle*` service functions (docs/04's `asyncHandler` selector) and a floating `void` promise. The section 3.1 ESLint block rejected a `kitApi` import in the adapter. `add-harness.rb` (writer) ran twice on a fresh copy of a prebuilt Expo project (second run a no-op) and produced the target, scheme entry, `TEST_HOST` and the Debug-only entitlement. The `storekit-harness.ts` scenario runner, the `create-premium-iap.ts` client and the flow file were rewritten in review: they type-check, lint and load under Node, but were not run end to end.
- **Premium store and lint merge (2026-09-26, `scratchpad/fix-final/repo`).** `premium-store.ts` passes `tsc`, docs/04's merged ESLint and Prettier; docs/05's `premium-entry.test.tsx` and docs/07's `render-with-shell.test.tsx` drive it through `renderWithShell` (`isPremium` seed, `premium-granted` dispatch) and pass. The merged config still rejects a `kitApi` import in `expo-iap-purchase-adapter.ts`, while the adapter itself lints clean.
- **StoreKit harness with a React Native + expo-iap 5.8.0 app** (bundle `dev.example.e07spike`): hosted test target added with the `xcodeproj` gem 1.25.0; `build-for-testing` succeeded in Release (≈50 s incremental) and Debug (≈2 min); arming via `test-without-building -only-testing:StoreKitHarness/ArmTests/<test>`; app launched with `xcrun simctl launch` (and with Metro for Debug); results as listed in section 3.8. Logs read with `log show --info --debug`. Maestro 2.10.0 tapped the simulated Apple Account alert. The simulators used were created for the run and deleted afterwards.
- **Earlier spike (native SwiftUI, same day):** the XCUITest-runner and scheme-configuration approaches failed; the hosted approach and the `get-task-allow` requirement were established there.
- **expo-iap 5.8.0 source read:** `ErrorCode` values, `PurchaseIOS` fields (`revocationDateIOS`, `purchaseState`), `getAvailablePurchases` default, `restorePurchases` (`SyncError`), `requestPurchase` shapes, plugin option types (`iapkitApiKey`, `module`, `modules.onside`, `ios.alternativeBilling`, `enableLocalDev`, `localPath`) and the three Onside switches in `resolveModuleSelection` and `ExpoIap.podspec`; openiap-apple: `.pending` → `deferredPayment`, `requestPurchase` emits and rethrows.
- **Apple documentation read:** App Store Connect API request schemas (JSON reference; `pricePoints` `limit` maximum 8000; `GET /v1/apps/{id}/inAppPurchasesV2` accepts `filter[productId]`), the first-IAP-with-a-version rule, product-ID rules, Family Sharing irreversibility, the App Store localization list (no Persian or Sorani; re-read by the reviewer).
- **Xcode 26.6 SDK headers:** every `SKTestSession` member used by `ArmTests.swift` exists; `failTransactionsEnabled` is marked deprecated since iOS 17. Maestro 2.10.0 `test --help` lists `--include-tags`/`--exclude-tags` (there is no `--tags`).
- **Not verified:** the ASC scripts against the live API (no key in the agent environment); a real device purchase (Tier 3 is the owner's); cancel on the real purchase sheet; Android.

**Re-verify** (versions age): `npm view expo-iap version`, the tarball's `openiap-versions.json`, the Tier-1 suite, the Tier-2 scenarios on a fresh simulator, and a Tier-3 TestFlight run before shipping an upgrade.

---

## Open issues

1. **"Config plugin adds the harness" (FINAL 26) is implemented as a post-prebuild step.** The verified mechanism is the `xcodeproj` Ruby gem run by `storekit-harness.ts` right after a fresh test-variant prebuild, not an Expo config plugin inside every prebuild. This keeps the harness out of every other build by construction (Debug-only entitlement unchanged). Porting it into a `withXcodeProject` + `withDangerousMod` plugin is possible later but unverified.
2. **Refunds are not pushed to a running app in the test store.** After `refundTransaction`, the relaunched RN app got no update event; only the launch re-check (`Transaction.all`) saw the revocation. Real App Store behaviour may differ; the design handles both paths.
3. **Resolved (2026-09-30): the price.** The owner chose €1.99, an App Store price point (FINAL H.2). The script's exact-match lookup has not run against the live API yet (no API key); it stops rather than guess if the point is missing.
4. **`sync-error` on a cancelled Apple Account prompt** is taken from the source; in the simulator a cancelled simulated sign-in alert still let `restorePurchases` resolve. Tier 1 covers the mapping; Tier 3 is the real check.
5. **Resolved: `persistPremium` contract.** It takes `{ isPremium: true }` or `{ isPremium: false, revokedAtMs }` (a `PremiumChange`), because docs/06's `keepPremiumUnlessRevoked` ignores a revoke without a date; docs/06 sections 4.1 and 6.8 use the same shapes.
6. **Resolved: fake factory name.** docs/03 names the fake `createFakePurchase` (`fake-purchase.ts`); this doc and docs/07 section 3.8.6 use it.
7. **Resolved (2026-09-30, re-run 2026-10-01): the Tier-2 runner and its seven flows ran as a whole** on Line Siege (`io.applander.linesiege.premium`), each time on a fresh throwaway `e07-…-storekit` simulator (iOS 26.5, Xcode 26.6) named in every call. The first runs found two bugs, both fixed: the test build's network guard blocked the Debug build's own Metro (5 of 7 failed), and a refund was not revoked when the launch re-check ran before the first network state (1 of 7 failed). The third run printed `storekit: 0 of 7 scenario(s) failed` (exit 0), and so did a run from an independent build after the switch to `--device` on 2026-10-01. Each time the simulator was deleted and `npx expo prebuild --platform ios --clean` removed the harness afterwards. Round 5 (2026-10-01) made the runner give each flow its own Maestro driver port, wait 60 s for the relaunch re-check (StoreKit took 28 s once) and print a busy note when the Mac's load average is above twice its cores (5 of 7 flows timed out at a load near 600 on 12 cores with a correct app); on a fresh simulator it printed `storekit: 0 of 7 scenario(s) failed` again (the runner above is the premium-purchase skill's current file).
8. **Two gaps in `premium-reducer.test.ts` (Stryker, docs/07 open issue 11).** No example dispatches `connect-started` (NoCoverage at `premium-reducer.ts:22`), and replacing `state.flow.kind === 'loading'` (line 27) with `true` survives. Add one example for each when the reducer is implemented.
