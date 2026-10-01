# Testing Premium: three tiers

## Contents

- Tier 1: Jest (every commit)
- Tier 2: the hosted-XCTest StoreKit harness (before each release, after each expo-iap upgrade)
- Tier 2 files
- Tier 2 scenarios and flows
- Running Tier 2 by hand
- Release-day order
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
| `busy-note.ts` (+ `busy-note.test.ts`) | the note the runner prints before the run and after a failed one when the 1-minute load average is above twice the cores: StoreKit's test store then answers slowly, so a timed-out flow may not be an app bug |
| `storekit-harness.ts` | the runner: fresh test-variant prebuild, harness files + target, Debug `build-for-testing` against this run's own Metro port (`RCT_METRO_PORT`), Metro on that port, then per scenario: arm, run one Maestro flow with the global `--device <udid>` and its own driver port, a free one for each flow (`maestroGlobalArgs` and `driverPortFor` from `packages/tooling/src/e2e/maestro-args.ts`, e2e-maestro's shared helper) |

The flows live in `packages/shell/e2e/storekit/` (outside `e2e/flows/`, so the normal E2E run never runs them against an unarmed build) and use the shared `../subflows/debug-setup.yaml` (the test-build debug deep link `<scheme>://debug/setup?<query>`; the Shell keeps one copy of it, shared with the E2E flows: it first waits for the app's first screen root, because right after `launchApp` the app's JS may not be listening to links yet, and the app queues a link until its navigator is ready; its guards tap only Apple's "Open in ...?" alert, never a bare 'Open', which in an `ADS_MODE=test` build also matches the AdMob test banner's "OPEN" button). Harness builds use `ADS_MODE=off`, so the flows check Premium states, not banners.

## Tier 2 scenarios and flows

In the runner's order (refund needs the purchase, approval needs the pending one):

| Flow | Arm | Deep-link query and UI steps | Expected |
|---|---|---|---|
| `01-buy.yaml` | `testArmDefault` | `firstRun=0&premium=0&screen=premium`, tap `premium.buy-button` | `premium.state.success` |
| `02-refund-relaunch.yaml` | `testRefundAll` | relaunch, `screen=premium` | `premium.buy-button` (Premium off after the launch re-check; waits up to 60 s) |
| `03-ask-to-buy.yaml` | `testArmAskToBuy` | `premium=0&screen=premium`, tap `premium.buy-button` | `premium.state.pending` |
| `04-approval-relaunch.yaml` | `testApproveAll` | relaunch, `screen=premium` | `premium.state.owned`, without any tap (waits up to 60 s) |
| `05-restore.yaml` | `testArmDefault` | `premium=0&screen=premium`, buy, `premium=0` again, tap `premium.restore-button` | `premium.state.owned` |
| `06-failure.yaml` | `testArmFail` | `premium=0&screen=premium`, tap `premium.buy-button` | `premium.state.error` |
| `07-store-unavailable.yaml` | none | `premium=0&offline=1&screen=premium` | `premium.state.unavailable` |

Flow 07 works only because the port is wrapped in `withConnectivity` and the debug switch notifies ConnectivityPort subscribers: the armed StoreKit test store itself is always reachable, so without the gate the page would show a price.

The relaunch flows start with `- launchApp` (Maestro stops the app first) and pass only `screen=premium`, so the cached Premium from the previous flow is what the re-check must change. Never use `launchApp: { clearState: true }` here: uninstalling cleared the test transactions, and `clearState` may reinstall.

The relaunch flows wait 60 s for their state, not 15 s: the launch re-check reads `Transaction.all`, and after an arm step that changed the test store (`testRefundAll`, `testApproveAll`) StoreKit answers it only once storekitd has synced its transaction cache ("Transaction cache is stale", then a sync). On 2026-10-01 that sync took 28 s after `testRefundAll`, and the 15 s wait of flow 02 ended 2.6 s before the revocation arrived, with a correct app. `check-premium.mjs` rule `harness-relaunch-wait` holds every `premium.*` wait in the two relaunch flows at 60000 ms or more; Premium stays on while the re-check waits, as rule 2 requires, so the long wait never hides a wrong state.

Status: first real runs of `storekit-harness.ts`, 2026-09-30 (Xcode 26.6, iOS 26.5 simulator `e07-r4-host-storekit`, a fresh one per run, its UDID named in every call; Line Siege, `io.applander.linesiege`, product `io.applander.linesiege.premium`; the runner's own free ports, in run 3 Maestro driver port 54878 and Metro 54879):

| Run | Result | Cause and fix |
|---|---|---|
| 1 | 5 of 7 failed | The test build's network guard blocked Metro's HMR websocket and LogBox covered the app (see Tier 2 gotchas). Fixed in the guard: loopback passes in a `__DEV__` build. |
| 2 | 1 of 7 failed (`02-refund-relaunch`: Premium stayed on) | The launch re-check ran before the first network state arrived, saw the store as unavailable and kept Premium; once online, `connectPremiumReloads` reloaded the store but never re-checked. Fixed: the online reload is followed by `recheckPremium` (Jest: "rechecks Premium once the first network state says online (a refund is revoked on launch)"; `check-premium-behaviour.mjs` rule `store-reloads`). |
| 3 | `storekit: 0 of 7 scenario(s) failed`, exit 0 | All seven flows passed. |

Afterwards the simulator was deleted and `npx expo prebuild --platform ios --clean` regenerated `ios/` without the harness target and the `.storekit` file (Release-day order, steps 3 and 4).

After the switch from the per-command `--udid` to the global `--device` (with `maestroGlobalArgs`), an independent build of the Shell and Line Siege, made only from these skills, ran the harness once more:

| Date | Command | Simulator | Ports | Result |
|---|---|---|---|---|
| 2026-10-01 | `node packages/tooling/src/storekit/storekit-harness.ts --app line-siege --device <udid>` | a fresh `e07-<purpose>-storekit` (iOS 26.5, Xcode 26.6), deleted afterwards | the runner's own free driver port, then one port for the whole run (64567 for all seven flows) | `storekit: 0 of 7 scenario(s) failed`, exit 0 |

That runner still picked one driver port per harness run. Every Maestro run now picks its own (a free port for each flow, `check-premium.mjs` rule `harness-maestro`), as every other repo tool does.

With its own driver port for each flow, the 60 s relaunch wait and the shared debug-setup sub-flow whose guards tap only Apple's "Open in ...?" alert, the harness ran again on 2026-10-01 on the Line Siege pilot with the full Shell (iOS 26.5, Xcode 26.6; each run on a fresh `e07-<purpose>-storekit` simulator, its UDID named in every call):

| Run | 1-minute load (12 cores) | Result | Cause and fix |
|---|---|---|---|
| a | not measured | 1 of 7 failed (`02-refund-relaunch`: `premium.buy-button` not visible) | The 15 s wait ended 2.6 s before the revocation: StoreKit answered the launch re-check only after a 28 s transaction sync. Fixed: 60 s waits in both relaunch flows (`harness-relaunch-wait`, fixture `bad-harness-relaunch-wait`). |
| b | 450 to 630 (other builds on the Mac) | 5 of 7 failed (flows 02 to 06 timed out on their state) | Not the app: the overloaded Mac made StoreKit's test store answer slowly. The runner now prints the busy note (`busy-note.ts`) before the run and after a failed one; rerun on a fresh simulator once the load is below twice the cores. |
| c | 8 at the start (up to about 220 during its own build) | `storekit: 0 of 7 scenario(s) failed`, exit 0 | All seven flows passed, each on its own driver port (64379, 64905, 49171, 50045, 51060, 52109, 52974), Metro on 63906. Then `xcrun simctl delete <udid>` and `npx expo prebuild --platform ios --clean` (no `StoreKitHarness` target and no `.storekit` file left). |

## Running Tier 2 by hand

```sh
UDID=$(xcrun simctl create e07-storekit "iPhone 17 Pro" com.apple.CoreSimulator.SimRuntime.iOS-26-5)
xcrun simctl boot "$UDID"
node packages/tooling/src/storekit/storekit-harness.ts --app line-siege --device "$UDID"
xcrun simctl delete "$UDID"                              # the test store persists per simulator
```

The runner picks a free Maestro driver port for every flow and one free Metro port for the run (listening on port 0); `--driver-port <n>` passes one fixed driver port for every flow and `--metro-port <n>` a fixed Metro port. It refuses a non-UDID `--device` or a bad port before it builds anything. Every Maestro call is `maestro --device <udid> --driver-host-port <port> test <flow>`, and its log line names both (`maestro: device <udid>, driver port <port>: test <flow>`): a per-command `--udid` alone and the default driver port 7001 let a call reach whichever simulator's XCTest driver already listens there (in round 3 a hierarchy call answered from another session's simulator), and the default Metro port 8081 would load another session's bundle.

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

Name throwaway simulators `e07-<purpose>` and delete them afterwards; name the UDID in every `simctl`, `xcodebuild` (`-destination id=<udid>`) and Maestro call, never `booted`.

## Release-day order

E2E, the harness and the store build share `apps/<game>/ios`, and the harness leaves a Debug project with its test target, `Premium.storekit` and the Debug `get-task-allow` entitlement in it. So on a release day, in this order:

1. The E2E evidence run (e2e-maestro's `npm run e2e:ios -- --app <game>`: a clean prebuild and a Release test build).
2. This harness on its own simulator: `node packages/tooling/src/storekit/storekit-harness.ts --app <game> --device <udid>` (its fresh test-variant prebuild replaces `ios/`).
3. `xcrun simctl delete <that udid>`: the armed StoreKit test store persists per simulator.
4. `npx expo prebuild --platform ios --clean` in `apps/<game>` before any Release or store build, which removes the harness target, the `.storekit` file and the entitlement; the store-artifact gate still checks the IPA.

## Tier 2 gotchas

- `failTransactionsEnabled = false` alone did not leave fail mode; `testArmDefault` calls `resetToDefaultState()` for that.
- `failTransactionsEnabled` is deprecated since iOS 17 ("Use simulatedError(forAPI:)"); Xcode warns but it still worked on iOS 26.5. If it stops working, `testArmFail` becomes `try await s.setSimulatedError(.generic(.unknown), forAPI: .purchase)` (not verified).
- Once, after a reinstall, the simulated "Sign in with Apple Account ... [Environment: Xcode]" alert appeared during a StoreKit call; Maestro `tapOn: "OK"` (or `"Cancel"`) dismisses it.
- A relaunch flow that fails with `Assertion is false: id: premium.buy-button is visible` (flow 02) or `premium.state.owned` (flow 04) while the screen shows the previous Premium state usually waited too little, not a wrong app: StoreKit answers the launch re-check only after its transaction sync (28 s once). Read the simulator log for `TransactionQuery(kind: all` and the next `Finished iterating transaction batches` in the app's process; the gap is the sync. Keep the 60 s wait (`harness-relaunch-wait`) and rerun on a fresh simulator; only a state that is still wrong after 60 s is an app bug.
- Maestro 2.10 has `--include-tags`/`--exclude-tags`, not `--tags`; `JAVA_HOME` must point at Java 17.
- The harness app is a Debug test build, so the test build's JS network guard (e2e-maestro's `screens/debug/network-guard.ts`) runs in it too. It must let a Debug build reach its own Metro on loopback (the bundle and the HMR websocket on `localhost:<metro port>`): on 2026-09-30 a guard that blocked every websocket threw "N3: websocket to http://localhost:<port>/hot blocked" from `HMRClient.setup`, LogBox covered the app, and 5 of 7 flows failed. Loopback is not network traffic (the runtime `lsof` audit allows it too), and Release E2E builds have `__DEV__` false, so they still block everything.

## Tier 3: the owner on TestFlight

Once per game, and after an expo-iap upgrade (a human step; explain it in plain words and wait for the result):

1. Install the TestFlight build, open Premium, buy (sandbox, not charged); check that the ads are gone.
2. Delete and reinstall the app, tap Restore; check that Premium returns.
3. Start a purchase and cancel it; the page returns quietly with no message.

This is the only test of the real App Store sheet, the Apple Account prompt and restore after reinstall. Changes to product metadata can take up to an hour to reach the sandbox.

## Keeping the harness out of shipped builds

Harness builds are Debug simulator builds from a separate prebuild and are never uploaded. The next normal build starts with `npx expo prebuild --platform ios --clean`, which removes the harness target, the `.storekit` file and the Debug entitlement. The store-artifact gate on the exported IPA still asserts that there is no `*.storekit`, no `*.xctest` and no `get-task-allow`.
