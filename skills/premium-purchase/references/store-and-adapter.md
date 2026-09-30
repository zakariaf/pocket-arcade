# expo-iap, PurchasePort and the adapter

## Contents

- What Premium is (spec N7, 8.9, D2, D3)
- Three StoreKit facts that shape everything
- Versions, install and the config plugin
- Banned APIs and plugin options (no server, no extra SDK)
- PurchasePort
- The expo-iap adapter
- Error codes -> S12 results
- Re-verify after an upgrade

## What Premium is (spec N7, 8.9, D2, D3)

- One non-consumable product per game, "Premium", about EUR 1.90 (D3: EUR 1.90 where the store allows, otherwise the nearest Apple price point such as EUR 1.99). No subscriptions, coins, consumables or second product (N7).
- It removes all ads, and hints and continues become free (D2). Levels are never sold.
- Each game is its own app, so each has its own Premium; buying it in one game unlocks nothing elsewhere.
- After a purchase the Shell stores "Premium = yes" on the phone; from then on it works offline forever without asking the store again. When online, the Shell quietly re-checks at app start and on return to the foreground (for example after a refund).
- Restore is required (App Review 3.1.1) and is available in S12 and Settings. Reinstall or a new phone plus Restore gives Premium back.
- No server receipt checks: there is no server. StoreKit 2 transactions are signed and verified on the device.
- The price comes from the store, never from code or catalogs. Premium is never pushed with pop-ups: the only entry points are the Home button (hidden once owned), the Settings row, and at most one line on the Result screen per day (`result.premium-nudge`).

## Three StoreKit facts that shape everything

Verified on 2026-09-26 in the StoreKit test harness with an Expo SDK 57 app and expo-iap 5.8.0:

1. **StoreKit re-delivers transactions.** An unfinished purchase comes back at every launch, and even a finished, owned purchase was re-delivered through the update listener on relaunch. So every handler is idempotent, and Premium is saved before `finishTransaction`.
2. **Absence is not evidence.** A fresh purchase can be missing from `Transaction.currentEntitlements` for a moment, and the purchase sheet makes the app inactive/active, which triggers a foreground re-check right after buying. Premium is revoked only when a verified transaction carries a revocation date.
3. **Failures arrive twice on iOS.** A failed or deferred `requestPurchase` both rejects its promise and fires `purchaseErrorListener` with the same code. The reducer ignores the duplicate (failures count only while the flow is `purchasing`).

## Versions, install and the config plugin

| Item | Version (2026-09-26) | Note |
|---|---|---|
| `expo-iap` | 5.8.0 exact | openiap-apple 3.6.0 (StoreKit 2), openiap-google 3.6.0 (Play Billing 9.1.0) |
| Fallback | 5.6.3 | openiap-apple 3.4.0 |
| iOS deployment target | 16.4 | Expo SDK 57 default |

```sh
# inside every apps/<game>
npm install -E expo-iap@5.8.0
npx expo prebuild --platform ios --clean
```

- The plugin entry in the Shell's one plugin list (`shellPlugins` in `packages/shell/src/config/shell-plugins.ts`, which `withShell` spreads) is the bare string `'expo-iap'`, with no options object at all.
- No iOS entitlement is needed for in-app purchase (the verified harness purchases ran with an app whose entitlements were empty apart from the Debug-only `get-task-allow`).
- It is a single-maintainer project with very frequent releases, hence the exact pin. 5.8.0 was published on 2026-09-26 and 5.8.1 the same day; stay on 5.8.0 until 5.8.1 (or later) has passed the re-verification below. Until 5.8.0 is 7 days old (2026-10-03) the repo's `.npmrc` release-age policy accepts it only through the dated `min-release-age-exclude[]=expo-*` line of the bootstrap block; an `ETARGET` error means that block is missing (dependency-management work), never a reason to loosen the pin.

## Banned APIs and plugin options (no server, no extra SDK)

| Banned | Why |
|---|---|
| `kitApi`, `KitApiError`, `verifyPurchaseWithProvider` | call IAPKit at `https://kit.openiap.dev` (a server; spec N2/N3) |
| `verifyPurchase` (either branch) | the Google branch needs a server token; iOS verification is already done by StoreKit 2 |
| `useIAP` | hides connection and finishing logic the Shell must own |
| `andDangerouslyFinishTransactionAutomatically` | finishing before saving loses purchases |
| plugin options `iapkitApiKey`, `module: 'onside'`, `modules.onside`, `ios.alternativeBilling`, `enableLocalDev`, `localPath` (any options object) | the Onside switches add the OnsideKit pod from the CocoaPods trunk; IAPKit adds a server |
| `expo.ios.onside.enabled`, environment variable `EXPO_IAP_ONSIDE=1` | the other two Onside switches (read in the 5.8.0 plugin and podspec) |

Metro does not tree-shake, so the IAPKit client is present in every bundle through the index re-export; banning the entry points (lint and this skill's checker) is what keeps it unused. The lint config's vendor-SDK rule bans `expo-iap` everywhere except the adapter, and a second rule keeps the five server names banned inside the adapter too.

## PurchasePort

```ts
export type StoreProduct = { readonly productId: string; readonly displayPrice: string; readonly price: number | null; readonly currency: string };

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
  readonly fetchProduct: (productId: string) => Promise<StoreProduct | null>; // null: store returned []
  readonly requestPurchase: (productId: string) => Promise<void>; // outcome arrives via subscribe()
  readonly finish: (transaction: StoreTransaction) => Promise<void>;
  readonly restore: () => Promise<'synced' | 'sync-failed'>; // AppStore.sync()
  readonly readTransactions: () => Promise<readonly StoreTransaction[]>; // Transaction.all
  readonly subscribe: (listener: (event: PurchaseEvent) => void) => () => void;
};
```

`fake-purchase.ts` (`createFakePurchase(script)`) scripts the store for Jest: connection, product (or `null`), restore result, transactions, and an `emit(event)` to deliver listener events; it records calls such as `requestPurchase`, `persist:true`, `finish:t1` in order.

## The expo-iap adapter

`expo-iap-purchase-adapter.ts` is the only file that imports `expo-iap`. Facts behind it (5.8.0 source, openiap-apple, and the harness):

- `fetchProducts({ skus: [id], type: 'in-app' })` returns `[]` instead of throwing when StoreKit cannot resolve the product: `fetchProduct` returns `null`, which the flow shows as "store unavailable", never as an error dialog.
- `getAvailablePurchases()` defaults to `onlyIncludeActiveItemsIOS: true` (`Transaction.currentEntitlements`); the adapter passes `false` to read `Transaction.all`, which still contains refunded purchases with `revocationDateIOS`.
- `restorePurchases()` returns `void` (it runs `AppStore.sync()` and then reads purchases); it throws `ErrorCode.SyncError` when the sync does not complete (cancelled Apple Account prompt, offline). The adapter maps that to `'sync-failed'`, and the service then reads the transactions itself.
- `requestPurchase({ request: { apple: { sku }, google: { skus: [sku] } }, type: 'in-app' })`; a rejection is emitted as a failure event (it may duplicate the listener's).
- `finishTransaction({ purchase, isConsumable: false })`.
- A purchase with `purchaseState === 'unknown'` is dropped; `transactionId ?? id` is the transaction ID.
- `purchaseUpdatedListener` de-duplicates by transaction ID within a connection session, but a relaunch re-delivers.
- StoreKit's `Product.price` arrives as a binary double (`1.9899999999999998` for 1.99); currency formatting rounds it correctly.
- Ask to Buy on iOS is StoreKit `.pending`, which openiap maps to the error code `deferred-payment` (rejection and listener).
- A test-environment failure (`failTransactionsEnabled`) arrives as code `unknown` -> `failed`.

## Error codes -> S12 results

Codes are the string values of expo-iap 5.8.0's `ErrorCode`:

| `ErrorCode` value | `PurchaseFailure` | S12 result |
|---|---|---|
| `user-cancelled` | `cancelled` | quietly back to the page, no message |
| `deferred-payment`, `pending` | `deferred` | pending: "Waiting for approval - you can keep playing." |
| `already-owned` | `already-owned` | runs Restore automatically |
| `network-error`, `service-error`, `service-disconnected`, `service-timeout`, `billing-unavailable`, `iap-not-available`, `init-connection`, `connection-closed`, `not-prepared` | `unavailable` | "Connect to the internet to buy or restore." |
| anything else (`unknown`, `purchase-error`, `item-unavailable`, `sku-not-found`, `query-product`, ...) | `failed` | "The purchase couldn't be completed. You were not charged." + Try again |
| `sync-error` (from `restorePurchases` only) | none | restore failed toast |

The Premium page never shows a store error text from Apple; only the catalog messages.

## Re-verify after an upgrade

1. `npm view expo-iap version time --json`: the new version must be at least 7 days old; read the release notes and the tarball's `openiap-versions.json`.
2. Rerun Tier 1 (Jest) and Tier 2 (the StoreKit harness), and ask the owner for a Tier 3 TestFlight buy / cancel / reinstall + restore before shipping the upgrade (see `references/testing-tiers.md`).
3. Re-read `ErrorCode`, `getAvailablePurchases`, `restorePurchases` and the plugin option types in the new source; update the mapping table, `assets/premium-facts.json` and the stand-in `scripts/lib/stubs/expo-iap.mjs` if anything moved.
