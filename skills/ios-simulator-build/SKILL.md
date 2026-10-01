---
name: ios-simulator-build
description: Builds and runs a Pocket Arcade game as a Release iOS simulator app - clean prebuild, xcodebuild on Xcode 26.6, test/store variants, Metro cacheVersion, e07- simulators, screenshot. Use when building, running, smoke-testing or fixing a simulator build. Not for TestFlight (ios-release-testflight).
---

# iOS simulator build

Turns `apps/<game>` into a Release simulator app with one command, `npm run build:ios:sim`, and proves what was built: the pinned Xcode made it, the variant is the one asked for (test code present in test builds, absent in store builds), and the app actually starts and draws. No Xcode GUI, no Metro, no signing.

## Rules that must hold

1. **Build only through `npm run build:ios:sim -- --app <game> [--variant test|store] [--ads off|test|live]`, starting from a clean prebuild. Never edit or commit `ios/`.** Continuous Native Generation regenerates `ios/` and silently drops hand edits; the fix always goes into `app.config.ts`, `withShell` or a config plugin.
2. **Select Xcode by version through `DEVELOPER_DIR`; never run `xcode-select` or `sudo`.** `/Applications/Xcode.app` is Xcode 27.0 on this Mac; one global switch builds every app with the iOS 27 SDK and a black screen on SDK 57.
3. **Export `APP_VARIANT`, `EXPO_PUBLIC_APP_VARIANT` (same value) and `ADS_MODE` once, for the whole run.** The variant enters the binary three times (prebuild, the Constants phase, Metro); a lost variable silently mixes variants.
4. **Every app's `metro.config.js` keys `config.cacheVersion` on `EXPO_PUBLIC_APP_VARIANT`.** Verified: without it a store build made after a test build shipped the debug module.
5. **Test-only code is reachable only through `packages/shell/src/app/test-only.ts`, gated by the literal `process.env.EXPO_PUBLIC_APP_VARIANT === 'store'`.** Verified: an imported `IS_TEST_BUILD` constant keeps the module in store bundles.
6. **Simulators are named `e07-<purpose>`, created once, targeted by UDID; only `e07-*` devices are ever shut down or deleted, never `all`.** Every `simctl` call names the UDID, `xcodebuild` uses `-destination id=<udid>`, and every Maestro run (`--link`) names `--device <udid>` and a driver port of its own before the command (`maestroGlobalArgs`, a free port or `--driver-port <n>`; `check-sim-setup` rule `maestro-device`). Other agents use other simulators on this Mac, and in round 3 another session's Maestro driver answered on the shared default port.
7. **Wait on a signal, never a fixed sleep, then look at the screenshot.** A build that "succeeded" can still launch to a black or white screen; only the picture shows it.
8. **Set `EXPO_NO_TELEMETRY=1` and `CI=1` in every tooling process.** No telemetry, and no prompt that would hang an unattended run.
9. **Owner steps are asked for, never worked around:** installing Xcode and accepting its licence (O4) need the owner's password.
10. **Every build carries Apple's tracking prompt text; a store build carries the game's own id.** `check-sim-app` requires `NSUserTrackingUsageDescription` in `Info.plist` and in `en`, `de`, `fa` and `ckb.lproj/InfoPlist.strings` of every build (owner decision O1: the app asks App Tracking Transparency after Google's form, and iOS kills an app that asks without the text), and in a store build (or with `--game`) `CFBundleIdentifier` `io.applander.<game id without hyphens>`, never `com.example.*` (owner decision O4). A scaffold value the owner replaces fails rule `owner-placeholder` by field: the AdMob app id and (live) units (owner step G5) and, in a store build, the `example.com` links (owner step G3); the line before `RESULT: FAIL` is then `OWNER STEPS PENDING: G3, G5` (only the steps pending), the expected result of a store build until the owner supplies them (lead decision L14).

## Workflow

1. **First time in a repo, or when a check fails on setup:** read [references/environment-and-xcode.md](references/environment-and-xcode.md) (toolchain, owner steps, Xcode selection, .gitignore) and [references/build-variants.md](references/build-variants.md) (matrix, the three moments, both traps). **Prerequisite:** privacy-and-network-audit's tooling (`packages/tooling/src/audit/`, `packages/tooling/network-audit/`) and the `audit:privacy` script are in the repo before the first build, because the build runs `audit:privacy` after every prebuild. `build-ios-sim.ts` checks every npm script it runs before it touches anything, and stops with exit 2 (`preflight failed, nothing was built`) when a target file is missing.
2. **Install the templates that are missing** (copy each to the same path in the repo; `__GAME_ID__` is the game's folder name):

   | Template | Goes to |
   |---|---|
   | `templates/apps/game/metro.config.js` | `apps/<game>/metro.config.js` (every app) |
   | `templates/packages/shell/src/app/test-only.ts`, `test-only-entry.ts`, `test-only-api.ts` | same paths (the entry lists every test-only export plus the sentinel, each tagged `/** @public */` because only `require` in `test-only.ts` reaches it and knip's `includeEntryExports` would report it; it re-exports the S15 `DebugScreen` (toybox-screens), e2e-maestro's debug kit (`createDebugServices`, `createSimulatedConnectivity`, `createSimulatedClock`, `installNetworkGuard`, `createDebugLinkHandler`, `createSqliteKvDebugStoreAdapter`), toybox-visual-parity's parity harness (`readParityRequest`, `startParitySession`, `parityDoc`, the motion switch `isParityMotionFrozen`, the board probe launch `isParityBoardProbeOn`, the design fixture `parityGameFixture` and the rest under `app/parity/`) and performance-budgets' `createPerfLog` (`app/perf/perf-log.ts`). A member joins once its file exists: until then drop its export and its `TestOnlyApi` field, never the sentinel; at Shell steps 4 to 6 the pair holds only `TEST_BUILD_SENTINEL` (the Shell core's members join at step 7), and `DebugScreen` stays out while S15 is outside `shell-slice.json`. In a partial Shell `test-only.ts` and the pair are Shell core, in every Shell app whatever the slice; `DebugScreen` and `FontTestScreen` (S15's font test page) stay out while S15 is outside `shell-slice.json`. The entry and `test-only-api.ts` are one shared pair with one editor, synced from the library into this skill, toybox-visual-parity and architecture-and-boundaries; `check-sim-setup` rule `entry-api-match` fails when a member and an export disagree) |
   | `templates/packages/shell/src/app-env.d.ts` | same path |
   | `templates/packages/shell/src/config/app-variant.ts` + `.test.ts` | same paths |
   | `templates/packages/tooling/src/ios/toolchain.ts`, `simulators.ts` + tests | same paths |
   | `templates/packages/tooling/src/build/sim-build-plan.ts` + test, `build-ios-sim.ts` | same paths |
   | `templates/packages/tooling/src/e2e/maestro-args.ts` + test | same paths (shared with e2e-maestro; `--link` builds its Maestro line with it) |

   Root `package.json` script: `"build:ios:sim": "node packages/tooling/src/build/build-ios-sim.ts"`. Add the `.gitignore` lines from the environment reference. Then run `npm run -s check:fast` (tsc, ESLint, Jest cover the templates).
3. **Check the setup:** `node ${CLAUDE_SKILL_DIR}/scripts/check-sim-setup.mjs .` from the repo root. Fix every `FAIL` line (each names the file, rule and fix) and rerun until `RESULT: PASS`.
4. **Build and run:** `npm run build:ios:sim -- --app <game>` (test variant, test ads, simulator `e07-smoke`; `--help` prints the options; `--link '<debug query>'` also screenshots the screen that link opens, for example `--link 'firstRun=0&level=1&screen=game'`; it opens the link through e2e-maestro's Maestro and `debug-setup.yaml`, because `simctl openurl` leaves iOS's "Open in <app>?" prompt up). In a copied or moved repo it deletes `apps/<game>/build/dd` first when that DerivedData names another folder (its precompiled modules would fail with `missing required module 'SwiftShims'`). It first checks that every npm script it runs points at an existing file (exit 2 before the prebuild otherwise; step 1's prerequisite). Right after the prebuild it runs `npm run audit:privacy -- --app <game>` (it reads `ios/Pods`); a failure there is a missing privacy-manifest reason, fixed in `withShell`, never skipped. Read [references/simulator-commands.md](references/simulator-commands.md) when a step fails, when you run a step by hand, or before changing the script. The run prints the app path and the screenshot path.
5. **Prove the build:** `node ${CLAUDE_SKILL_DIR}/scripts/check-sim-app.mjs --app <printed .app path> --variant test --ads test --game <game>`, then `node ${CLAUDE_SKILL_DIR}/scripts/check-screenshot.mjs reports/ios/<game>/`, then open the PNG with the Read tool and look at it (right screen, text drawn, no alert, no notification banner, no blank area). Dismiss a notification before the screenshot; `check-screenshot` fails a light banner over the top (`system-banner`).
6. **When the change touches variants, `metro.config.js`, `test-only*`, `withShell` or the build tooling:** build the store variant right after the test variant, without clearing any cache (`--variant store --ads live`, or `--ads off` until the game has real AdMob IDs), and run `check-sim-app.mjs` on both. [examples/variant-proof.md](examples/variant-proof.md) shows the commands and the passing output.
7. **On any failure**, match the text in [references/failures.md](references/failures.md), fix the cause (never the check), rerun the failing step, then the checks. Stop and ask the owner for O4 or anything else that needs a password.
8. **Report** in plain words: game, variant/ads, simulator and model, screenshot path, what the screenshot shows, and the three `RESULT` lines.

## Definition of done

- [ ] `npm run build:ios:sim -- --app <game>` ran from a clean prebuild and printed `ready (...)` with a screenshot path.
- [ ] The screenshot was opened and looked at, and shows the intended screen (not black, white or an alert).
- [ ] For variant or tooling changes: a test and a store build made back to back both pass `check-sim-app.mjs`.
- [ ] Only `e07-*` simulators were created or touched, each by its UDID (Maestro with `--device` and its own driver port); no `xcode-select`, `sudo` or `simctl ... all` anywhere; the session's simulators are shut down at the end.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-sim-app.mjs --app <app> --variant <v> --ads <m> --game <game>` and `node ${CLAUDE_SKILL_DIR}/scripts/check-screenshot.mjs reports/ios/<game>/` print `RESULT: PASS`.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-sim-setup.mjs .` prints `RESULT: PASS`

## Anti-patterns

- **Opening `ios/` in Xcode to fix a build setting.** The next prebuild erases it; put the setting in `withShell` or a config plugin.
- **`sudo xcode-select -s /Applications/Xcode.app` because "xcodebuild picked the wrong one".** Pass `DEVELOPER_DIR` from `selectXcode()`.
- **`APP_VARIANT=store npx expo prebuild` and then `xcodebuild` in a fresh shell.** The Constants phase and Metro then see no variant; export once and keep it.
- **`const IS_TEST = ...; if (IS_TEST) require('./debug')`.** Only the literal comparison in `test-only.ts` strips code.
- **`npx expo start`, `npx expo run:ios` or a Debug build to "check quickly".** Metro, the dev menu and LogBox are not what players run, and `run:ios` builds Debug on whatever Xcode `xcode-select` points at; the smoke test is the Release build.
- **`sleep 10 && simctl io screenshot`.** Too short on a cold Mac, wasted time on a warm one; poll the ready signal.
- **`xcrun simctl shutdown all` or `erase all` to get a clean state.** Delete or reset only your `e07-*` simulator.
- **Declaring success from `** BUILD SUCCEEDED **`.** Launch, screenshot, check and look.
- **Deleting `audit:privacy` or its step because the first build stopped at the preflight.** Install privacy-and-network-audit's tooling instead; the audit is what keeps an undeclared required-reason API out of the build.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/environment-and-xcode.md](references/environment-and-xcode.md) | Toolchain versions, owner steps, Xcode selection, tool env, move to Xcode 27, .gitignore, disk | Workflow step 1, and when Xcode or the Mac setup changes |
| [references/build-variants.md](references/build-variants.md) | The variant matrix, the three moments, Metro cache trap, imported-constant trap, test-only gate, app-env.d.ts, what proves a variant | Workflow steps 1 and 6 |
| [references/simulator-commands.md](references/simulator-commands.md) | Every command of the run with its flags, simulator models, ready signal, verified pitfalls, other simctl commands, timings | Workflow step 4, and when running a step by hand |
| [references/failures.md](references/failures.md) | Symptom, cause and fix for environment, prebuild, xcodebuild, variant, simulator and TypeScript failures | Workflow step 7, whenever something fails |
| [examples/variant-proof.md](examples/variant-proof.md) | A real back-to-back test and store build with the checker output and the report | Workflow step 6 |
| `templates/apps/game/metro.config.js` | Metro config with the variant cache key (synced from the library; do not edit here) | Workflow step 2 |
| `templates/packages/shell/src/app/` | `test-only.ts` gate, `test-only-entry.ts` with the sentinel and `@public` tags, `test-only-api.ts` (all three synced from the library; do not edit here) | Workflow step 2 |
| `templates/packages/shell/src/app-env.d.ts` | `EXPO_PUBLIC_APP_VARIANT` and `process` declarations (synced from the library; do not edit here) | Workflow step 2 |
| `templates/packages/shell/src/config/` | `app-variant.ts` (variant rules) and its Jest test (synced from the library; do not edit here) | Workflow step 2 |
| `templates/packages/tooling/src/ios/` | `toolchain.ts` (Xcode pin and selection; it and its test are synced from the library, identical to ios-release-testflight's copy; do not edit here), `simulators.ts` (e07- simulators) and their tests | Workflow step 2 |
| `templates/packages/tooling/src/build/` | `build-ios-sim.ts` (the CLI: `--help`, the preflight of every npm script it runs, stale DerivedData dropped, `--link` with `--driver-port`), `sim-build-plan.ts` (pure plan: arguments and usage, `buildScriptProblems`, `isStaleDerivedData`, `moduleCachePathIn`, `linkSetupArgs` with the device and driver port first, `maestroEnvOf`) and its test | Workflow step 2 |
| `templates/packages/tooling/src/e2e/maestro-args.ts` | `maestroGlobalArgs`, `freeDriverPort`, `driverPortFor`, `maestroRunLine` (synced from the library, identical to e2e-maestro's copy; do not edit here) | Workflow step 2 |
| `templates/packages/tooling/src/e2e/maestro-args.test.ts` | Its test | Workflow step 2 |
| `scripts/check-sim-setup.mjs` | Checks the repo setup: cache key, gate, sentinel, the entry's `@public` tags (`entry-public`) and that every `TestOnlyApi` member has an export of the same name and back (`entry-api-match`), Xcode pin, scene support, build args, npm script, the scripts the build runs (`build-prereqs`: `audit:privacy` and its file), simulator safety, every Maestro spawn naming its device and driver port (`maestro-device`), .gitignore | Workflow step 3 and the definition of done |
| `scripts/check-sim-app.mjs` | Checks a built `.app` against its variant: Xcode, platform, sentinel, EXConstants, AdMob ID, owner placeholders by field (`owner-placeholder`, then `OWNER STEPS PENDING: G3, G5`), the app id (`bundle-id`), the tracking prompt text in every language (`att-string`), Info.plist keys, StoreKit files; exports `PLACEHOLDERS` | Workflow steps 5-6 and the definition of done |
| `scripts/check-screenshot.mjs` | Checks screenshots for the device size, a blank screen and a light system banner over the top | Workflow step 5 |
| `scripts/lib/plist.mjs` | XML and binary plist reader used by the app check | Never by hand |
| `scripts/lib/png.mjs` | PNG decoder, colour measure and the light-banner row count used by the screenshot check | Never by hand |
| `scripts/lib/maestro-spawns.mjs` | The `maestro-device` rule (synced from the library, identical to e2e-maestro's copy; do not edit here) | Never by hand |
| `scripts/lib/ship-placeholders.mjs` | The scaffold placeholders a ship gate refuses by name, each with its owner step, `ownerStepsPendingLine` and the io.applander app id rule (synced from the library; do not edit here) | Never by hand |
| `scripts/lib/tracking-text.mjs` | Reads `NSUserTrackingUsageDescription` from `Info.plist` and each `.lproj/InfoPlist.strings` (synced from the library; do not edit here) | Never by hand |
| `scripts/selftest.mjs` | Pins `PLACEHOLDERS`, then proves all three checkers pass good fixtures and catch every planted bug | After changing a checker or a template |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/shared.json` | Declares the shared files this skill copies in | When adding a shared file |
| `tests/fixtures/` | Good and planted-bad repos, `.app` bundles and screenshots for the self-test | When adding a rule to a checker |

## Related skills

- `ios-release-testflight` - signed archive, export, validation, upload and TestFlight.
- `architecture-and-boundaries` - `withShell`, `game.config.ts` and where the variant files live.
- `e2e-maestro` - flows and the screenshot matrix on top of a test-variant simulator build.
- `toybox-visual-parity` - comparing built screens with their design screenshots.
- `troubleshooting-playbook` - failures outside the simulator build.
- `expo-sdk-upgrade` - moving Expo SDK or Xcode versions.
