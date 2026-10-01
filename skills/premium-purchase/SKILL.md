---
name: premium-purchase
description: Builds and checks each game's one Premium purchase - expo-iap behind PurchasePort, S12 state reducer, save-before-finish, pending, restore, refund revocation, store price, StoreKit harness, App Store Connect product. Use when touching IAP, buy, restore or Premium state. Not for ads (admob-ads).
---

# Premium purchase

Makes each game sell its single non-consumable "Premium" honestly and with no server: StoreKit 2 verifies on the phone, Premium is saved before a transaction is finished, only explicit evidence ever revokes it, every S12 state is reachable and tested, and two scripts prove it on the real code.

## Rules that must hold

1. **Save Premium before finishing: `persistPremium({ isPremium: true })` (synchronous) -> dispatch `premium-granted` -> `finish(tx)`.** Never finish first, never auto-finish. *Why:* StoreKit re-delivers unfinished transactions; a finished-but-unsaved purchase is lost for good.
2. **Revoke only on explicit evidence:** a verified Premium transaction with a revocation date and no newer valid one. Absence, errors and offline keep the cached Premium; a revocation is saved with its `revokedAtMs`. *Why:* a fresh purchase can be briefly missing from StoreKit, and the save guard ignores a revoke without a date.
3. **Listen first:** `startPremium` subscribes to purchase events before `initConnection`, then loads the price, then re-checks silently (`Transaction.all`, `onlyIncludeActiveItemsIOS: false`). *Why:* StoreKit replays unfinished and approved Ask-to-Buy transactions right after connecting, and only `Transaction.all` shows refunds.
4. **Every handler is idempotent;** a failure counts only while a purchase is in flight. *Why:* iOS reports one failure twice (rejection and listener) and re-delivers owned purchases on relaunch.
5. **Restore distinguishes "couldn't restore" from "nothing to restore":** a failed sync (cancelled Apple Account prompt, offline) is always `restore-failed`; `restore-empty` only after a successful sync with no evidence. *Why:* telling a paying player "no purchase found" because the network failed is the worst answer.
6. **`expo-iap` is exactly 5.8.0, imported only by `expo-iap-purchase-adapter.ts`, and its plugin entry is the bare string `'expo-iap'`.** Never `kitApi`, `KitApiError`, `verifyPurchaseWithProvider`, `verifyPurchase`, `useIAP`, `andDangerouslyFinishTransactionAutomatically`, any plugin option, `ios.onside.enabled` or `EXPO_IAP_ONSIDE`. *Why:* they add a server (IAPKit) or the OnsideKit pod (spec N2/N3), or hide the finishing logic.
7. **One product per game: `<bundleId>.premium` (`io.applander.<game id without hyphens>.premium`, owner decision O4), NON_CONSUMABLE, the EUR 1.99 App Store price point (O2), `familySharable: false` (O3: Family Sharing stays off, never turned on).** Every StoreKit configuration (the template and each generated `*.storekit`) and the ASC payload say `false`; `create-premium-iap.ts` targets exactly 1.99. *Why:* spec N7; the owner decided the price and Family Sharing on 2026-09-30; product IDs can never be reused, and Family Sharing cannot be turned off once on.
8. **An empty product list, a failed connection or being offline is "store unavailable", never an error dialog;** the port is `withConnectivity(createExpoIapPurchaseAdapter(), connectivity.isOnline)`, and a connectivity change reloads the store when `shouldReloadStore` says so. Apple's error texts are never shown. *Why:* StoreKit returns `[]` instead of throwing; S12 has its own catalog messages; and the debug "Simulate offline" switch (Tier 2 flow 07) only reaches the store through ConnectivityPort.
9. **Show the price the store reports, in the player's digits (`formatStorePrice`, fallback `displayPrice`).** Never type a price into code or catalogs; catalogs use `{priceText}`. The EUR 1.99 point is what App Store Connect sells in Germany; players elsewhere see their own territory's price. *Why:* spec S12 and Apple's per-territory price points.
10. **Every S12 state is designed and tested:** reducer tests for each (Tier 1), the StoreKit harness before each release and after every expo-iap upgrade (Tier 2), and the owner's TestFlight run per game (Tier 3). *Why:* spec S12/15.5; the real purchase sheet only exists on TestFlight.
11. **All S12 text comes from the Shell catalogs in en, de, fa and ckb.** *Why:* App Store Connect has no Persian or Sorani, and its texts are never shown in the app.
12. **The StoreKit harness exists only in throwaway harness builds;** `get-task-allow`, `*.storekit` and `*.xctest` never ship. *Why:* `get-task-allow` in a store build is a security hole and a rejection.
13. **Premium changes only through the reducer, after the save:** purchases, restores and re-checks via the service; the test build's debug switch (`premium=0|1`) via `debug-premium-set`, only from test-only code. *Why:* one path keeps ads, the save and S12 in step, and a stray unlock would give Premium away.
14. **Premium is never pushed with pop-ups:** Home button (hidden once owned), Settings row, at most one Result-screen line per day (`premiumNudgePrice` against the save's `upsell.lastShownOn`). *Why:* spec S12 rules.
15. **The owner does the App Store Connect human steps** (agreements, the app record with its fixed id, attaching Premium to the first version, the TestFlight test); the price (EUR 1.99) and Family Sharing (off) are decided, so there is no price or Family Sharing question. Ask in plain words and wait; never submit anything yourself, and stop only if Apple no longer offers EUR 1.99.

## Workflow

1. Read [references/store-and-adapter.md](references/store-and-adapter.md). Install `npm install -E expo-iap@5.8.0` in every app. The bare string `'expo-iap'` (no options) is already a line of the Shell's one plugin list, `shellPlugins` in `packages/shell/src/config/shell-plugins.ts` (architecture-and-boundaries ships it); never add a second list. Set `premium.productId` to `<bundleId>.premium` in each `game.config.ts`.
2. Copy the templates at the same relative paths: `templates/packages/shell/src/services/purchase/`, `templates/packages/shell/src/stores/premium/`, `templates/__mocks__/expo-iap.ts`. Keep existing `packages/shell/src/app/stores-context.tsx` and the save service; the store needs both.
3. Read [references/premium-states.md](references/premium-states.md). The composition root is game-host-integration's template set (`packages/shell/src/app/`): it builds the port where the adapter is created (`withConnectivity(createExpoIapPurchaseAdapter(), isOnline)` in `device-adapters.ts`), the dependencies once (`create-premium-deps.ts`), calls `startPremium` (never awaited) and right after it `connectPremiumReloads(connectivity, stores, premiumDeps)` (`connect-premium-reloads.ts`: `loadStore` when `shouldReloadStore(flow, isOnline)` on a connectivity change, `recheckPremium` when the app comes back to the foreground online). `startPremium` runs before the first network state arrives, so without the reloads Settings and S12 never show a price after an offline start. Wire `buyPremium` and `restorePremium` on the S12 buttons, and render S12 from `premiumView` and `premiumNotice` with the test IDs and copy keys in its tables. [examples/wire-premium.md](examples/wire-premium.md) shows each call in place. The S12 layout comes from its Toybox design (hand off to `toybox-screens`), and every state screen must then match its design screenshot (`toybox-visual-parity`).
4. Make sure the four Shell catalogs hold every Premium key from the copy deck (the i18n work owns the texts), with `{priceText}` in the price keys.
5. Run Tier 1: `npx jest packages/shell/src/stores/premium packages/shell/src/services/purchase packages/shell/src/app/connect-premium-reloads.test.ts --ci --selectProjects unit --coverage --collectCoverageFrom='packages/shell/src/{stores/premium,services/purchase}/**/*.ts' --coverageThreshold='{}'` (paths first; only `npm run test:coverage` judges the thresholds).
6. Run `node ${CLAUDE_SKILL_DIR}/scripts/check-premium.mjs .` and `node ${CLAUDE_SKILL_DIR}/scripts/check-premium-behaviour.mjs .`. Fix every `FAIL` line (file, rule, fix) and rerun until both print `RESULT: PASS`. Early in the Shell build order two rules are not due yet and print `SKIP` lines instead (a pass): `plugin-entry` until `packages/shell/src/config/shell-plugins.ts` exists (Shell step 8) and `catalog-keys` until `packages/shell/src/i18n/catalogs/en.json` exists (Shell step 6); once the file exists the rule is strict. `price-target` and `family-sharing` read the ASC tooling and every StoreKit configuration once they are in the repo.
7. Before a release and after an expo-iap upgrade: read [references/testing-tiers.md](references/testing-tiers.md), copy `templates/packages/tooling/src/storekit/`, `templates/packages/tooling/src/e2e/maestro-args.ts` (+ test, if the repo lacks e2e-maestro's copy) and `templates/packages/shell/e2e/storekit/`, and make sure `packages/shell/e2e/subflows/debug-setup.yaml` is the Shell's one copy (e2e-maestro installs the same bytes; `templates/packages/shell/e2e/subflows/debug-setup.yaml` is that shared file: it waits for the app's first screen before it opens the debug link). Run the Tier 2 harness on a throwaway simulator of your own (`e07-<purpose>`; the harness gives Maestro the global `--device <udid>` and its own driver port, and Metro its own port) in the release-day order of testing-tiers.md: the E2E evidence run first, then the harness, then `xcrun simctl delete <udid>`, then `npx expo prebuild --platform ios --clean` before any Release or store build.
8. For the store step read [references/app-store-connect.md](references/app-store-connect.md): ask the owner for the human steps, copy `templates/packages/tooling/src/asc/` (keep existing ASC client files) and `templates/packages/tooling/src/clock/system-clock.ts` if missing, and run `create-premium-iap.ts <bundleId>`: it sets exactly the EUR 1.99 price point with Family Sharing off, and stops (then ask the owner) only if Apple no longer offers EUR 1.99.
9. Ask the owner for the Tier 3 TestFlight run (buy, cancel, reinstall + restore) and report the result in plain words.

## Definition of done

- [ ] `expo-iap` is exactly 5.8.0, imported only by the adapter; the plugin entry is the bare string; no banned API, option or Onside switch anywhere.
- [ ] Every template file is in place and Tier 1 passes (reducer, notice, nudge, evidence, service, connectivity gate, price, ASC payloads).
- [ ] A purchase saves Premium, updates ads at once, then finishes; pending shows "Waiting for approval" and an approval later turns Premium on without a tap.
- [ ] Restore shows `restore-failed` after a failed sync and `restore-empty` only after a successful one; refunds revoke only with a revocation date.
- [ ] Offline (and with the debug offline switch) S12 shows "store unavailable" without asking StoreKit: the port is wrapped in `withConnectivity` where the adapter is created; after an offline start the price loads once the network comes (`connectPremiumReloads` after `startPremium`).
- [ ] Prices come from the store in the player's digits; S12 texts exist in all four catalogs; every S12 state has its test ID.
- [ ] Every S12 state screen has passed the Toybox visual-parity check against its design screenshot.
- [ ] Before a release: the seven Tier 2 scenarios pass on a throwaway simulator in the release-day order (E2E, harness, delete the simulator, clean prebuild); the store IPA has no `*.storekit`, `*.xctest` or `get-task-allow`; the owner's Tier 3 run passed for this game and version.
- [ ] Premium is `<bundleId>.premium` at the EUR 1.99 price point with Family Sharing off in every StoreKit configuration and ASC payload (`price-target`, `family-sharing`).
- [ ] The product exists in App Store Connect (en-US/de-DE texts, EUR 1.99, Family Sharing off, availability, review screenshot) and is attached to the first version.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-premium.mjs .` and `node ${CLAUDE_SKILL_DIR}/scripts/check-premium-behaviour.mjs .` both print `RESULT: PASS`

## Anti-patterns

- **Finishing the transaction first "so StoreKit stops re-sending it".** Re-delivery is the safety net; save, grant, then finish.
- **Turning Premium off because the re-check found nothing.** Absence is not evidence; only a revocation date is.
- **Showing "No purchase to restore" when `restorePurchases` threw.** That is `restore-failed`.
- **`useIAP` or `verifyPurchase` "for simplicity".** They hide finishing or call a server; the adapter template is the whole integration.
- **Giving the plugin `{ iapkitApiKey }` or any options object.** Even an empty object fails the audit; use `'expo-iap'`.
- **Typing "€1.99" in a catalog, a test fixture of the screen, or a component.** Use `{priceText}` and `formatStorePrice`.
- **Reading `getAvailablePurchases()` with the default active-only list.** Refunds disappear from it; pass `onlyIncludeActiveItemsIOS: false`.
- **`launchApp: { clearState: true }` in a Tier 2 flow.** Uninstalling clears the test transactions.
- **Handing the raw expo-iap adapter to the service.** Without `withConnectivity` the store ignores ConnectivityPort: offline S12 waits on StoreKit and Tier 2 flow 07 (`offline=1`) shows a price instead of "store unavailable".
- **Putting a StoreKit flow under `e2e/flows/`.** The normal E2E run would run it against an unarmed build.
- **Pushing Premium with a pop-up after a loss or on launch.** Only the three quiet entry points.
- **Editing a Jest test or a fixture until the checker passes.** The behaviour check runs the real modules; fix the module.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/store-and-adapter.md](references/store-and-adapter.md) | Premium rules, the three StoreKit facts, versions, bans, PurchasePort, adapter facts, error-code table, re-verify | Workflow step 1, and before touching the adapter |
| [references/premium-states.md](references/premium-states.md) | Reducer and actions, the S12 state table (views, test IDs, copy keys), restore toasts, service order, wiring, edge cases, price display | Workflow step 3, and on any state change |
| [references/testing-tiers.md](references/testing-tiers.md) | Tier 1 tests, the verified StoreKit harness, its files, scenarios, commands and gotchas, Tier 3 steps | Workflow steps 5 and 7 |
| [references/app-store-connect.md](references/app-store-connect.md) | Product rules, the EUR 1.99 price (O2), Family Sharing off (O3), the ASC API script, remaining steps, human steps, Android later | Workflow step 8 |
| [examples/wire-premium.md](examples/wire-premium.md) | The complete wiring for the pilot game | Workflow step 3, as the model |
| `templates/packages/shell/src/services/purchase/` | Port, expo-iap adapter, fake, connectivity gate `withConnectivity` (+ test), service (+ test), store flow with `shouldReloadStore`, price formatter (+ test) | Workflow step 2 |
| `templates/packages/shell/src/stores/premium/` | State, transitions, reducer (+ test), view, notice (+ test), Result-screen nudge (+ test), evidence (+ test), Zustand store | Workflow step 2 |
| `templates/__mocks__/expo-iap.ts` | Jest root mock (real `ErrorCode`, no banned APIs) | Workflow step 2 |
| `templates/packages/tooling/src/storekit/` | `Premium.storekit.template` (EUR 1.99, Family Sharing off), `storekit-harness.entitlements`, `ArmTests.swift`, `add-harness.rb`, `storekit-harness.ts` (explicit `--device`, its own driver and Metro ports) | Workflow step 7 |
| `templates/packages/tooling/src/e2e/` | `maestro-args.ts`: the shared Maestro target helper (`maestroGlobalArgs`, `freeDriverPort`, `driverPortFor`) with its test; e2e-maestro's file, synced from the library (do not edit here) | Workflow step 7, with the harness |
| `templates/packages/shell/e2e/storekit/` | The seven Tier 2 Maestro flows | Workflow step 7 |
| `templates/packages/shell/e2e/subflows/debug-setup.yaml` | The debug deep-link subflow the flows call (the Shell's one shared copy, synced from the library: it waits for the first screen before the link; do not edit here) | Workflow step 7 |
| `templates/packages/tooling/src/asc/` | ASC payloads (+ test), `create-premium-iap.ts`, JWT, credentials and client | Workflow step 8 |
| `templates/packages/tooling/src/clock/system-clock.ts` | The tooling wall clock with `nowEpochSeconds` and `todayIso` | Workflow step 8, if missing or lacking `nowEpochSeconds` |
| `assets/premium-facts.json` | Pinned version, adapter allowlist, banned APIs and config words, catalog keys, S12 test IDs, views, required files, Family Sharing decision | Read by the checkers; update on an upgrade or an owner decision |
| `scripts/check-premium.mjs` | Static checks: files, pin, imports, banned APIs, plugin options, adapter facts, the adapter wrapped in `withConnectivity` where it is created, the debug Premium action only in test-only code, product IDs, typed prices (the parity harness's fixture store excepted), catalog keys, S12 test IDs, harness isolation (the repo scan skips `skills/`, `.claude/` and generated folders), StoreKit config, Family Sharing, the EUR 1.99 target and every StoreKit `displayPrice` (`price-target`) and Family Sharing off in the StoreKit template, every generated `apps/<id>/ios/*.storekit` and the ASC payload (`family-sharing`), and the StoreKit harness's Maestro calls through `maestroGlobalArgs`, never `--udid` (`harness-maestro`) | Workflow step 6 |
| `scripts/check-premium-behaviour.mjs` | Runs the repo's Premium modules (type stripping) against the S12 table, evidence, service order, restore, revocation, offline gate, Result-screen nudge and price rules, the expo-iap adapter against a scripted expo-iap (error codes, restore, `Transaction.all` mapping, call shapes), and the composition root's two store reloads (`store-reloads`) | Workflow step 6 |
| `scripts/lib/repo-scan.mjs` | File listing and import parsing helpers | Read only to change a checker |
| `scripts/lib/load-ts.mjs` | Imports repo TypeScript modules with the `@e07/*` aliases and the module stand-ins | Read only to change a checker |
| `scripts/lib/stubs/expo-iap.mjs` | Scripted Node stand-in for expo-iap 5.8.0 used by the behaviour check (update `ErrorCode` on an upgrade) | Read only to change a checker |
| `scripts/lib/assemble-fixtures.mjs` | Builds each self-test case from templates + base repo + `mutation.json` | Read only to add a self-test case |
| `scripts/selftest.mjs` | Proves both checkers on the clean repo and 52 planted problems | After changing a checker, a template or a fixture |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/shared.json` | Declares the shared files copied into this skill | When adding a shared file |
| `tests/fixtures/` | `base-repo/` plus one `mutation.json` and `EXPECT.txt` per case, per checker | When adding a rule |

## Related skills

- `admob-ads` - Premium turns ads off and perks free; it reads `isPremium`.
- `state-stores` - the store pattern and `createShellStores`, which creates the Premium store.
- `save-persistence-and-migrations` - the save's `premium` section and its revoke guard.
- `toybox-screens` - the S12 layout that renders the states and toasts.
- `toybox-visual-parity` - proves each S12 state screen matches its design screenshot.
- `i18n-strings-and-catalogs` - the Premium texts in four languages.
- `privacy-and-network-audit` - the network audit that fails on IAPKit or Onside.
- `ios-release-testflight` - signing, the store-artifact gate and the TestFlight human steps.
- `e2e-maestro` - Maestro installation and the debug deep link.
