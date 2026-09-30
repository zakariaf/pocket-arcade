# Testing Premium: three tiers

## Contents

- Tier 1: Jest (every commit)
- Tier 2: the hosted-XCTest StoreKit harness (before each release, after each expo-iap upgrade)
- Tier 2 files
- Tier 2 scenarios and flows
- Running Tier 2 by hand
- Tier 2 gotchas
- Tier 3: the owner on TestFlight
- Keeping the harness out of shipped builds

## Tier 1: Jest (every commit)

The reducer, the evidence rule, the service and the price formatter are tested without native code:

| Test file | Proves |
|---|---|
| `stores/premium/premium-reducer.test.ts` | every S12 view is reachable; the thank-you shows once; a duplicated failure is ignored; no evidence keeps Premium; only revocation evidence revokes; BUY is ignored offline or when owned; `connect-started` and a late `price-loaded`; approved Ask to Buy -> success; a launch delivery shows no thank-you |
| `stores/premium/premium-transitions.test.ts` | each transition on its own: a failure outside a purchase is ignored, deferred -> pending, a restore that finds Premium shows "restored" and never the thank-you, no evidence keeps Premium, the thank-you only after a purchase |
| `stores/premium/premium-store.test.ts` | the store starts from the saved entitlement, publishes reducer results and never writes the save itself |
| `stores/premium/premium-notice.test.ts` | the four restore toasts, and the restored toast shows once |
| `stores/premium/entitlement-evidence.test.ts` | absence -> `unknown`; refund -> `revoked`; newer purchase after a refund -> `owned`; other products ignored; latest revocation date |
| `services/purchase/premium-service.test.ts` | Premium is persisted before the transaction is finished; an empty product list -> store unavailable; a failed sync is "couldn't restore"; the launch re-check keeps Premium without transactions; a refunded transaction revokes |
| `services/purchase/connectivity-gated-purchase.test.ts` | offline nothing reaches StoreKit and S12 becomes "store unavailable"; online every call passes through; `shouldReloadStore` never reloads during a purchase or restore |
| `services/purchase/format-store-price.test.ts` | the four locale outputs and the `displayPrice` fallbacks |
| `packages/tooling/src/asc/premium-iap-payloads.test.ts` | the App Store Connect request bodies and price-point ranking |

The root mock `__mocks__/expo-iap.ts` exports no-op `jest.fn()`s for the functions the adapter imports (and re-exports the real `ErrorCode` from `expo-iap/build/types.js`, which has no native code), so importing the adapter in a test never touches native code. The banned server APIs are deliberately not mocked. Shell tests use `createFakePurchase`; `flushMicrotasks` (the Shell's testing helper) lets listener-driven work finish before assertions.

The skill's `check-premium-behaviour.mjs` runs the same state table against the repo's real reducer, notice, evidence and service modules, independently of the Jest files, and runs the real `expo-iap-purchase-adapter.ts` against a scripted expo-iap stand-in (error-code mapping, restore failure, `Transaction.all` mapping with revocation dates, call shapes).

## Tier 2: the hosted-XCTest StoreKit harness (before each release, after each expo-iap upgrade)

What was found (Xcode 26.6, iOS 26.5 simulator, 2026-09-26):

- `SKTestSession` created in an XCUITest runner does not control the app under test, and a StoreKit configuration referenced from the scheme is not applied by `xcodebuild test`.
- A hosted unit-test bundle (`TEST_HOST` = the app) that creates `SKTestSession(configurationFileNamed: "Premium")` inside the app process arms the simulator's StoreKit test environment for that bundle ID. The setting persists on that simulator, so the app launched afterwards by `xcrun simctl launch` (or Maestro) buys from the local `.storekit` file.
- The app must carry `get-task-allow`. Without it storekitd logs "not installed for development", `SKTestSession` logs `SKInternalErrorDomain Code=3`, and products come back empty, silently.
- Verified with a React Native app on expo-iap 5.8.0, in a Release simulator build and in a Debug build with Metro running: product `€1.99` / `1.9899999999999998 EUR`; purchase without a dialog -> `purchased` -> `finishTransaction`; Ask to Buy -> `deferred-payment` (rejection + listener) -> approve -> the next launch received the purchase; refund -> the next launch saw `revocationDateIOS` in `Transaction.all` and an empty active list, with no listener event; fail mode -> code `unknown`; `restorePurchases` after a purchase -> success and the purchase listed.
- Not testable here: restore after reinstall (uninstalling cleared the test transactions) and a player-cancelled sheet (dialogs are disabled). Tier 1 and Tier 3 cover both.

## Tier 2 files

All in `packages/tooling/src/storekit/` (templates in this skill):

| File | Role |
|---|---|
| `Premium.storekit.template` | StoreKit configuration v2.0 (accepted by Xcode 26.6); `__PRODUCT_ID__` becomes `<bundleId>.premium`; price 1.99, `familyShareable: false`, storefront DEU |
| `storekit-harness.entitlements` | `get-task-allow = true`, referenced by the app's Debug configuration only |
| `ArmTests.swift` | hosted tests: `testArmDefault`, `testArmAskToBuy`, `testArmFail`, `testApproveAll`, `testRefundAll` |
| `add-harness.rb` | adds the `StoreKitHarness` unit-test target to a freshly prebuilt project with the `xcodeproj` gem that ships with CocoaPods (idempotent; `PRODUCT_NAME = $(TARGET_NAME)` avoids the Xcode error `Multiple commands produce .../PlugIns/.xctest`; Debug-only entitlement) |
| `storekit-harness.ts` | the runner: fresh test-variant prebuild, harness files + target, Debug `build-for-testing`, Metro, then per scenario: arm, run one Maestro flow |

The flows live in `packages/shell/e2e/storekit/` (outside `e2e/flows/`, so the normal E2E run never runs them against an unarmed build) and use the shared `../subflows/debug-setup.yaml` (the test-build debug deep link `<scheme>://debug/setup?<query>`; the Shell keeps one copy of it, shared with the E2E flows: it first waits for the app's first screen root, because right after `launchApp` the app's JS may not be listening to links yet, and the app queues a link until its navigator is ready). Harness builds use `ADS_MODE=off`, so the flows check Premium states, not banners.

## Tier 2 scenarios and flows

In the runner's order (refund needs the purchase, approval needs the pending one):

| Flow | Arm | Deep-link query and UI steps | Expected |
|---|---|---|---|
| `01-buy.yaml` | `testArmDefault` | `firstRun=0&premium=0&screen=premium`, tap `premium.buy-button` | `premium.state.success` |
| `02-refund-relaunch.yaml` | `testRefundAll` | relaunch, `screen=premium` | `premium.buy-button` (Premium off after the launch re-check) |
| `03-ask-to-buy.yaml` | `testArmAskToBuy` | `premium=0&screen=premium`, tap `premium.buy-button` | `premium.state.pending` |
| `04-approval-relaunch.yaml` | `testApproveAll` | relaunch, `screen=premium` | `premium.state.owned`, without any tap |
| `05-restore.yaml` | `testArmDefault` | `premium=0&screen=premium`, buy, `premium=0` again, tap `premium.restore-button` | `premium.state.owned` |
| `06-failure.yaml` | `testArmFail` | `premium=0&screen=premium`, tap `premium.buy-button` | `premium.state.error` |
| `07-store-unavailable.yaml` | none | `premium=0&offline=1&screen=premium` | `premium.state.unavailable` |

Flow 07 works only because the port is wrapped in `withConnectivity` and the debug switch notifies ConnectivityPort subscribers: the armed StoreKit test store itself is always reachable, so without the gate the page would show a price.

The relaunch flows start with `- launchApp` (Maestro stops the app first) and pass only `screen=premium`, so the cached Premium from the previous flow is what the re-check must change. Never use `launchApp: { clearState: true }` here: uninstalling cleared the test transactions, and `clearState` may reinstall.

Status: each step was verified by hand; the runner and the seven flows as a whole are unrun until the pilot app exists. Its first run confirms Metro readiness and the flow order.

## Running Tier 2 by hand

```sh
node packages/tooling/src/storekit/storekit-harness.ts --app line-siege --udid <udid>
```

The equivalent steps, as run on 2026-09-26:

```sh
UDID=$(xcrun simctl create e07-storekit-tier2 "iPhone 17 Pro" com.apple.CoreSimulator.SimRuntime.iOS-26-5)
xcrun simctl boot "$UDID"
# after the prebuild, the harness files and add-harness.rb:
cd apps/line-siege/ios
xcodebuild build-for-testing -workspace LineSiege.xcworkspace -scheme LineSiege \
  -configuration Debug -sdk iphonesimulator -destination id=$UDID -derivedDataPath ../build/storekit
(cd .. && CI=1 npx expo start --port 8081 &)            # a Debug build loads JS from Metro
xcodebuild test-without-building -workspace LineSiege.xcworkspace -scheme LineSiege \
  -configuration Debug -destination id=$UDID -derivedDataPath ../build/storekit \
  -only-testing:StoreKitHarness/ArmTests/testArmDefault
xcrun simctl launch "$UDID" <bundleId>                  # or a Maestro flow
xcrun simctl spawn "$UDID" log show --last 2m --info --debug --style compact \
  --predicate 'process == "LineSiege" AND eventMessage CONTAINS "[premium]"'
xcrun simctl delete "$UDID"                              # the test store persists per simulator
```

Name throwaway simulators `e07-<purpose>` and delete them afterwards.

## Tier 2 gotchas

- `failTransactionsEnabled = false` alone did not leave fail mode; `testArmDefault` calls `resetToDefaultState()` for that.
- `failTransactionsEnabled` is deprecated since iOS 17 ("Use simulatedError(forAPI:)"); Xcode warns but it still worked on iOS 26.5. If it stops working, `testArmFail` becomes `try await s.setSimulatedError(.generic(.unknown), forAPI: .purchase)` (not verified).
- Once, after a reinstall, the simulated "Sign in with Apple Account ... [Environment: Xcode]" alert appeared during a StoreKit call; Maestro `tapOn: "OK"` (or `"Cancel"`) dismisses it.
- Maestro 2.10 has `--include-tags`/`--exclude-tags`, not `--tags`; `JAVA_HOME` must point at Java 17.

## Tier 3: the owner on TestFlight

Once per game, and after an expo-iap upgrade (a human step; explain it in plain words and wait for the result):

1. Install the TestFlight build, open Premium, buy (sandbox, not charged); check that the ads are gone.
2. Delete and reinstall the app, tap Restore; check that Premium returns.
3. Start a purchase and cancel it; the page returns quietly with no message.

This is the only test of the real App Store sheet, the Apple Account prompt and restore after reinstall. Changes to product metadata can take up to an hour to reach the sandbox.

## Keeping the harness out of shipped builds

Harness builds are Debug simulator builds from a separate prebuild and are never uploaded. The next normal build starts with `npx expo prebuild --platform ios --clean`, which removes the harness target, the `.storekit` file and the Debug entitlement. The store-artifact gate on the exported IPA still asserts that there is no `*.storekit`, no `*.xctest` and no `get-task-allow`.
