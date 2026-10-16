# Premium on Android: Google Play Billing through expo-iap

## Contents

- What changes on Android, and what does not
- Versions and the build
- Acknowledge only after the save
- Pending purchases
- Restore
- Refunds (owner default a)
- Errors and "store unavailable"
- The Play product (GP6) and its price
- License testers and Play-installed builds
- Tests and checks

## What changes on Android, and what does not

The same adapter, port, service, reducer, S12 states and catalogs serve both platforms. Only
`expo-iap-purchase-adapter.ts` knows the platform, and only through the fields of the purchase
expo-iap hands it. Every S12 state already exists; Android adds none.

| Topic | iOS (StoreKit 2) | Android (Play Billing) |
|---|---|---|
| `finishTransaction({ purchase, isConsumable: false })` | finishes the transaction | **acknowledges** the purchase (`acknowledgePurchaseAndroid`); `isConsumable: true` would consume it |
| An unfinished purchase | re-delivered to the listener at every launch | **never delivered again**; Google refunds it after 3 days |
| Unfinished in the re-check | not marked | `isAcknowledgedAndroid === false` -> `isUnfinished: true` |
| `restorePurchases()` | `AppStore.sync()`, then a query | the purchase query itself (no sync, no account prompt) |
| Refund evidence | `revocationDateIOS` in `Transaction.all` | none: a refunded purchase just disappears from the query |
| Pending | Ask to Buy (`purchaseState: 'pending'`) | slow payment methods and family approval (`purchaseState: 'pending'`) |
| Product | App Store non-consumable | Play one-time ("managed") product, acknowledged, never consumed |

## Versions and the build

- `expo-iap` stays exactly **5.8.0** on both platforms; on Android it runs openiap-google 3.6.0
  on **Play Billing Library 9.1.0** (the `google` entry of the package's `openiap-versions.json`).
- The plugin entry stays the bare string `'expo-iap'` (no options on any platform). The library adds
  `com.android.vending.BILLING` to the merged manifest itself.
- expo-iap's Android module builds with React Native's **Kotlin 2.1.20** only when the plugin list
  sets it: `['expo-build-properties', { android: { kotlinVersion: '2.1.20' } }]` sits in the one
  plugin list `shellPlugins` next to `'expo-iap'` (the `android-kotlin` rule). Another version breaks
  KSP for the Expo modules. `expo-build-properties` is installed through dependency-management.
- Banned on Android as on iOS: `verifyPurchase({ google })`, `verifyPurchaseWithProvider`,
  `kitApi` (all call a server), `useIAP`, and `alternativeBilling` (a second billing system).
  `consumePurchaseAndroid` and `acknowledgePurchaseAndroid` are not on the adapter's import list:
  the acknowledge goes only through `finishTransaction` in the port's `finish()`.

## Acknowledge only after the save

The order is the iOS order, and it matters more on Android because nothing re-delivers:

1. Play delivers the purchased update to `purchaseUpdatedListener`.
2. `processTransaction`: `persistPremium({ isPremium: true })` (synchronous) -> dispatch
   `premium-granted` -> `finish(tx)`, which calls `finishTransaction({ purchase, isConsumable: false })`.
3. When `persistPremium` returns `false` the purchase stays unacknowledged. Play does not deliver it
   again, so the next `recheckPremium` (launch, foreground, back online) or `restorePremium` reads
   it from `getAvailablePurchases` with `isAcknowledgedAndroid === false`, the adapter marks it
   `isUnfinished: true`, and the service acknowledges it once `persistPremium` has returned `true`.
4. A purchase Play already holds as acknowledged is never finished again.

`isConsumable: false` is required, not decorative: expo-iap's default is `false`, but a `true`
consumes the one-time product, after which Google lets the player buy Premium again and a reinstall
restores nothing. The `android-acknowledge` rule fails on any `isConsumable` other than `false` and
on a `finishTransaction` call anywhere but `finish()` (an acknowledge from the listener would run
before the save).

Google refunds an unacknowledged purchase automatically after **3 days**, so the launch re-check
(run before the first network state, then again when the network comes and on every foreground) is
what keeps a purchase whose save was refused from being refunded.

## Pending purchases

- A purchase paid by a slow method (cash at a shop, Google's "slow test card") or waiting for a
  family manager arrives with `purchaseState: 'pending'` and no `transactionId`.
- The adapter passes `state: purchase.purchaseState` unchanged (the `android-pending` rule). The
  service dispatches `purchase-pending` (S12 "Waiting for approval") and saves, grants and
  acknowledges **nothing**. Acknowledging a pending purchase fails anyway; granting it would give
  Premium away when the payment never completes.
- When the payment completes, Play sends the purchased update to the listener (the app may have
  been closed: the launch re-check then finds it unacknowledged). Premium turns on without a tap,
  then the purchase is acknowledged.
- A pending purchase in the re-check is not evidence: `entitlementEvidence` answers `unknown`.
- `ErrorCode.Pending` from `requestPurchase` maps to the `deferred` failure, the same pending state.

## Restore

- `restorePremium` calls `port.restore()` then `port.readTransactions()`. On Android
  `restorePurchases()` is itself a `getAvailablePurchases` query, and `readTransactions()` queries
  again with `onlyIncludeActiveItemsIOS: false` (an iOS-only flag Android ignores).
- `restore-failed` ("couldn't restore") whenever either query throws: billing unavailable, the Play
  Store app missing or signed out, offline (the connectivity gate answers `sync-failed` first).
  Never `.catch(() => [])` a query: that turns a failure into "nothing to restore".
- `restore-empty` ("nothing to restore") only after a query that succeeded and listed no Premium.
- A query listing Premium saves it (and acknowledges it if Play still holds it unacknowledged).
- Reinstall, or a new phone signed in with the same Google account, plus Restore gives Premium back.

## Refunds (owner default a)

Play gives the phone no dated proof of a refund: a refunded purchase simply stops appearing in
`getAvailablePurchases`, exactly like a purchase the query has not synced yet, and Google's
voided-purchases list needs a server. So on Android **absence never revokes Premium** (rule 2):
the re-check answers `unknown` and the cached Premium stays. Play's unspecified state
(`purchaseState: 'unknown'`) is dropped like on iOS, never read as a refund. The
`android-refund` behaviour cases prove both. The cost is accepted: a refunded Android player keeps
Premium on that phone; a reinstall then restores nothing.

## Errors and "store unavailable"

The adapter's `FAILURES` table already covers Play's codes: `billing-unavailable`,
`service-disconnected`, `service-timeout`, `iap-not-available`, `init-connection`, `network-error`
and `service-error` -> `unavailable`; `user-cancelled` -> `cancelled`; `already-owned` ->
restore; anything else -> `failed`. A phone without Google Play, a sideloaded build, or a product
Play does not return (`fetchProducts` answers `[]`) is "store unavailable", never an error dialog.

## The Play product (GP6) and its price

- One one-time ("managed") product per game: `<applicationId>.premium`, the same id as on iOS
  (owner decision O4: `io.applander.<game id without hyphens>.premium`, for Line Siege
  `io.applander.linesiege.premium`). Product ids can never be reused.
- Default price **EUR 1.99** (owner decision O2) with Google's local prices for the other
  countries. The app shows the price Play reports (`formatStorePrice`, fallback `displayPrice`),
  never a typed one.
- The owner creates it in the Play Console (Monetise with Play, Products, In-app products, Create
  product: id, Name "Premium", Description "No ads, ever. One-time purchase.", price, Save,
  Activate). Google allows products only after a build with the BILLING permission was uploaded,
  so this step (GP6) follows the first internal-testing upload (GP7). Until then Play-installed
  builds show "store unavailable". There is no Family Sharing setting to touch (O3).
- There is no API script for the Play product: Claude asks the owner, gives the values above, and
  never creates or changes anything in the Play Console itself.

## License testers and Play-installed builds

- Play Billing answers only in a build **installed from Google Play** (the internal testing track)
  whose package and signing match the Play app. An emulator or `adb install` build connects to no
  product: S12 shows "store unavailable", which is the correct result there, never a bug to fix.
- License testers (Play Console, Setup, License testing, licence response `RESPOND_NORMALLY`, the
  same accounts as the internal-testing list) buy with Google's test cards and are never charged:
  "always approves", "always declines" and the "slow test card" that stays pending a few minutes and
  then approves or declines (the pending path).
- The owner's Tier 3 run on Android, after the first internal release: buy, cancel, pending with
  the slow test card, then reinstall from Play and Restore. It is listed in the report and never
  waited for.
- There is no Android counterpart of the StoreKit harness: Tier 2 stays iOS-only. Android's proof
  is Tier 1 (`expo-iap-purchase-adapter.android.test.ts` in the `unit-android` Jest project), the
  behaviour checker's Android cases, and the owner's Tier 3 run.

## Tests and checks

- `templates/packages/shell/src/services/purchase/expo-iap-purchase-adapter.android.test.ts` runs
  where `Platform.OS` is `'android'` (the `unit-android` project, preset `jest-expo/android`, only
  `*.android.test.ts`): save, grant, then acknowledge, never consume; a refused save leaves it
  unacknowledged; pending neither granted nor acknowledged, then approved without a tap; the launch
  re-check acknowledges a saved, unacknowledged purchase; absence keeps Premium; restore owned,
  empty and failed; the product id; billing unavailable is "store unavailable".
- `check-premium.mjs`: `android-acknowledge`, `android-pending`, `android-kotlin`.
- `check-premium-behaviour.mjs` (the real adapter over a scripted expo-iap with Play's purchase
  shape): `android-pending` (pending then purchased; the re-check skips a pending purchase and
  acknowledges a saved one), `android-restore` (`restore-failed` versus `restore-empty`),
  `android-refund` (absence and Play's unspecified state never revoke).
