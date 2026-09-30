# The Premium state machine, the service and every S12 state

## Contents

- Files and who owns what
- The reducer and its actions
- Every S12 state: view, test ID and copy keys
- Restore outcomes: the toasts
- The Premium service: persist, pending, restore, revocation
- Wiring and timing
- Offline and edge cases
- Price display
- Entry points and texts

## Files and who owns what

| File | Job |
|---|---|
| `stores/premium/premium-state.ts` | `PremiumFlow`, `PremiumState`, `PremiumAction`, `initialPremiumState`, `priceOf`, `readyOrUnavailable` |
| `stores/premium/premium-transitions.ts` | the four non-trivial transitions (failure, restore finished, re-check, granted) |
| `stores/premium/premium-reducer.ts` | `premiumReducer(state, action)` |
| `stores/premium/premium-view.ts` | `premiumView(state)`: one value per S12 state |
| `stores/premium/premium-notice.ts` | `premiumNotice(state)`: the restore toasts |
| `stores/premium/premium-nudge.ts` | `premiumNudgePrice(input)`: the Result-screen line, at most once a day |
| `stores/premium/entitlement-evidence.ts` | `entitlementEvidence(transactions, productId)` and `latestRevocationMs` |
| `stores/premium/premium-store.ts` | the thin Zustand store: hydrated from the save's `premium` section, reduce -> publish |
| `services/purchase/premium-service.ts` | persist -> dispatch -> finish; restore; re-check; revocation |
| `services/purchase/premium-store-flow.ts` | `loadStore`, `startPremium` (listen first), `buyPremium`, `shouldReloadStore` |
| `services/purchase/connectivity-gated-purchase.ts` | `withConnectivity(port, isOnline)`: offline, the store reports itself unavailable without asking StoreKit |
| `services/purchase/format-store-price.ts` | the price in the player's digits |

All paths are under `packages/shell/src/`. The store does not write the save: the service persists first, then dispatches, so ads vanish everywhere at once from the same `isPremium`.

## The reducer and its actions

`PremiumState = { isPremium, didJustPurchase, didJustRestore, flow }`. `isPremium` is persisted and survives "Reset all progress"; `didJustPurchase` drives one thank-you animation; `didJustRestore` drives one "Purchase restored" toast; `flow` is the store flow (`loading`, `unavailable`, `ready`, `purchasing`, `pending`, `failed`, `restoring`, `restore-empty`, `restore-failed`), carrying the formatted price where one is known so the page stays readable.

| Action | Effect |
|---|---|
| `connect-started` | flow -> `loading` |
| `store-unavailable` | flow -> `unavailable` |
| `price-loaded` | `loading` -> `ready` with the price; ignored in any other flow |
| `buy-tapped` | -> `purchasing`, only from `ready`, `failed`, `restore-empty`, `restore-failed`, with a price, and not Premium |
| `purchase-failed` | only while `purchasing` (duplicates are no-ops): cancelled -> `ready`; deferred -> `pending`; already-owned -> `restoring` (the service runs restore); unavailable -> `unavailable`; failed -> `failed` |
| `purchase-pending` | `purchasing` -> `pending` |
| `premium-granted` | dispatched after the save was written: `isPremium` true; `didJustPurchase` true only when the flow was `purchasing` or `pending` (a purchase delivered at launch shows no thank-you out of context) |
| `restore-tapped` | -> `restoring` |
| `restore-finished` | `sync-failed` -> `restore-failed`; `owned` -> Premium on + `didJustRestore` (and `didJustPurchase` cleared: a restore shows the "restored" toast, never the thank-you); `revoked` -> Premium off; `unknown` -> `restore-empty` (only after a successful sync, and only when not Premium) |
| `entitlements-checked` | silent re-check: `owned` -> Premium on; `revoked` -> Premium off; `unknown` -> nothing changes |
| `thanks-shown` / `restore-notice-shown` | clear the one-shot flags |
| `debug-premium-set` | test builds only (debug switch "Premium on (no purchase)", debug link `premium=0|1`): sets `isPremium` and clears both one-shot flags. The debug handler first writes the save (`persistPremium({ isPremium: true })`, or `{ isPremium: false, revokedAtMs: clock.nowMs() }` so the save guard accepts it), then dispatches; it never touches StoreKit. Tier 2 flows 01, 03 and 05 rely on it |

## Every S12 state: view, test ID and copy keys

Spec S12 says every state must be designed and tested. `premiumView(state)` returns `success` or `already-owned` whenever `isPremium`, otherwise the flow's view. Copy keys are the Shell catalog keys (all four languages); test IDs follow `<screen>.<element>` and match the Toybox design.

| Spec S12 state | `PremiumView` | Reached by | What the page shows (copy keys) | State test ID |
|---|---|---|---|---|
| Loading price | `loading-price` | `connect-started` | BUY busy with `premium.loading`; rest readable; Restore enabled | `premium.state.loading` |
| Store unavailable / offline | `store-unavailable` | empty product list, connect failure, `unavailable` failure | note `premium.store-unavailable`; BUY disabled (`settings.premium.remove-ads-no-price`); Restore disabled | `premium.state.unavailable` |
| (normal page) | `ready` | `price-loaded`, cancelled | `premium.buy-button` = "Buy – {priceText}", Restore link `common.restore-purchase` | `premium.buy-button`, `premium.restore-button` |
| Purchase in progress | `purchase-in-progress` | `buy-tapped` | BUY busy with `premium.purchasing`; Restore disabled | `premium.state.purchasing` |
| Pending | `pending` | deferred failure or pending transaction | note `premium.pending` + `premium.pending-detail`; Restore enabled | `premium.state.pending` |
| Success | `success` | `premium-granted` while buying/pending | confetti, `premium.success.title`, `premium.success.body`, sticker `premium.active`; then `thanks-shown` | `premium.state.success` |
| Cancelled by player | `ready` | cancelled failure | no message | `premium.buy-button` |
| Error | `error` | failed | note `premium.error` + `premium.try-again` button | `premium.state.error`, `premium.try-again-button` |
| Already owned | `already-owned` | persisted Premium, restore or re-check evidence | sticker `premium.active`, `premium.owned.body`, Restore | `premium.state.owned` |

Also on the page: title `common.premium`, subtitle `premium.subtitle`, the three benefits (`premium.benefit.no-ads`, `premium.benefit.free-perks`, `premium.benefit.support`) and `premium.small-print`. The Settings row reads `settings.premium.remove-ads` ("Remove ads – {priceText}") or `premium.active`. The screen layout itself belongs to the Toybox screen work; this table is the logic contract it renders.

## Restore outcomes: the toasts

The design shows restore outcomes as toasts over the normal page (or the owned page). `premiumNotice(state)`:

| Notice | When | Toast test ID | Copy key |
|---|---|---|---|
| `restoring` | flow `restoring` | `premium.restoring-toast` | `premium.restoring` |
| `restore-success` | `didJustRestore` (then dispatch `restore-notice-shown`) | `premium.restore-success-toast` | `premium.restore-success` |
| `restore-empty` | flow `restore-empty` (successful sync, no evidence) | `premium.restore-empty-toast` | `premium.restore-empty` |
| `restore-failed` | flow `restore-failed` (sync failed or read failed) | `premium.restore-failed-toast` | `premium.restore-failed` |

"Nothing to restore" appears only after a successful sync; a failed sync (cancelled Apple Account prompt, offline) always shows "couldn't restore".

The flow stays `restore-empty` or `restore-failed` until the next action, so the screen shows a toast when `premiumNotice` changes to a new value (remember the last one shown in component state), not on every render; BUY and Restore stay usable underneath.

## The Premium service: persist, pending, restore, revocation

`PremiumServiceDeps = { port, productId, dispatch, persistPremium, formatPrice, onError }`.

- **`processTransaction(deps, tx)`** ignores other products. A `pending` transaction dispatches `purchase-pending`. A transaction with a revocation date triggers `recheckPremium` (a newer valid purchase still wins) and is then finished. A purchased transaction runs, in this order: `persistPremium({ isPremium: true })` (a synchronous SQLite write) -> `dispatch({ type: 'premium-granted' })` -> `finishQuietly(tx)`. If the app dies between the steps, StoreKit re-delivers the unfinished transaction; persisting again is harmless. Never finish first and never auto-finish.
- **`recheckPremium(deps)`** (launch, foreground, revocation): reads `Transaction.all`, applies explicit evidence only (`owned` persists Premium; `revoked` persists `{ isPremium: false, revokedAtMs: latestRevocationMs(...) }`), dispatches `entitlements-checked`. Any error keeps the cached state.
- **`entitlementEvidence`**: `owned` when a purchased Premium transaction has no revocation date; `revoked` when only revoked ones exist; `unknown` otherwise (absence is not evidence).
- **`restorePremium(deps)`**: `restore-tapped` -> `port.restore()`; `sync-failed` ends in `restore-finished: sync-failed`; otherwise read transactions, apply evidence, dispatch `restore-finished` with it (a read error also counts as `sync-failed`).
- **`processPurchaseEvent`**: a failure dispatches `purchase-failed`; `already-owned` then runs `restorePremium`.
- The save's `premium` section (owned by the save work) is never cleared by "Reset all progress"; a revoke is written only with its date (`keepPremiumUnlessRevoked` ignores a revoke without one).

## Wiring and timing

- `startPremium(deps)` runs once after the splash (never blocking it): subscribe to purchase events first (StoreKit replays unfinished and approved Ask-to-Buy transactions right after connecting), then `loadStore` (connect -> fetch product -> `price-loaded` or `store-unavailable`), then `recheckPremium`. Offline it ends in `store-unavailable` quickly; the cached `isPremium` from the save already controls ads.
- The port is `withConnectivity(createExpoIapPurchaseAdapter(), connectivity.isOnline)`. While ConnectivityPort says offline (a real outage, or the test build's "Simulate offline" switch, debug link `offline=1`), `connect` answers `false`, `fetchProduct` `null`, `restore` `'sync-failed'` and `readTransactions` `[]` (no evidence, so the cached Premium stays), all without calling StoreKit.
- On every ConnectivityPort change, call `loadStore(deps)` when `shouldReloadStore(flow.kind, isOnline)`: back online while the page says `unavailable`, or gone offline from a quiet page (`ready`, `failed`, `restore-empty`, `restore-failed`; never while loading, buying, pending or restoring). The debug switch must notify ConnectivityPort subscribers when it flips. On AppState -> `active`, call `recheckPremium(deps)` if online. Both live in game-host-integration's `packages/shell/src/app/connect-premium-reloads.ts`, called by the composition root right after `startPremium`: `startPremium` runs before expo-network reports its first state, so without them a launch stays on "store unavailable" and Settings never shows the price (`check-premium-behaviour.mjs` rule `store-reloads`).
- `buyPremium(deps)` dispatches `buy-tapped` and requests the purchase; the outcome arrives through the subscription.
- `persistPremium` is the save service's synchronous write; `formatPrice` is `(product) => formatStorePrice(product, localeTagFor(language, digits))`; `onError` is the ErrorLogPort.
- `premium-store.ts` creates the store from the loaded save (`save.doc().premium.owned`) and is provided with the other stores as `stores.premium`; read it with `usePremiumStore((state) => state.isPremium)`.

## Offline and edge cases

| Case | Behaviour |
|---|---|
| Premium owned, offline | ads off (cached); S12 shows "Premium – active"; a Restore tap ends in the restore-failed toast (the gated port answers `sync-failed`) |
| Not owned, offline | S12 `store-unavailable` at once (the gated port never asks StoreKit), BUY disabled; hints and continues follow the ad skill's perk offer |
| Purchase sheet open, app killed | StoreKit keeps the transaction; next launch: delivered -> saved -> finished |
| Crash between save and finish | re-delivered at next launch; saving again is harmless |
| Ask to Buy approved while the app is closed | delivered at next launch; no thank-you (flow was not buying) |
| Refund | the launch or foreground re-check sees the revocation date in `Transaction.all`; ads return. In the harness a refund produced no listener event, so the re-check is the path that catches it |
| Clock changes | irrelevant: no dates are compared on our side |
| Reset all progress | Premium kept |
| Save restored from backup / new phone (device backup, D5) | Premium from the save; the re-check confirms it, otherwise Restore |

## Price display

`formatStorePrice(product, localeTag)` formats `product.price` in `product.currency` with `Intl.NumberFormat(localeTag, { style: 'currency' })`, falling back to the store's `displayPrice` when there is no numeric price or the currency code is unknown. With the Shell's forced Intl polyfills and StoreKit's `1.9899999999999998` EUR: `en` -> `€1.99`, `de` -> `1,99 €`, `ckb-u-nu-arabext` -> `€ ۱٫۹۹` (a no-break space), `fa-u-nu-arabext` -> `€۱٫۹۹` preceded by a left-to-right mark. The result goes into `premium.buy-button` as `{priceText}`, which the translation helper isolates (FSI/PDI). Never type a price into code or catalogs, not even in the Result-screen nudge (`result.premium-nudge` takes `{priceText}`).

## Entry points and texts

- Entry points: the Home Premium button (hidden once owned; replaced by the small Premium badge), the Settings row, and at most one `result.premium-nudge` line per day on the Result screen. No pop-ups, ever.
- The Result line: `premiumNudgePrice({ isPremium, priceText: priceOf(flow), lastShownOn: save.upsell.lastShownOn, today })` gives the price text for the result model's `nudgePriceText`, or `null` (owner, no store price, already shown today). When the line is shown, write `upsell.lastShownOn = today` (a local `YYYY-MM-DD` day key from ClockPort) with the save's write; "Reset all progress" clears `upsell`, never `premium`.
- All S12 text comes from the Shell catalogs in en, de, fa and ckb. App Store Connect product texts exist only in en-US and de-DE (it has no Persian or Sorani localization); they are never shown in the app.
