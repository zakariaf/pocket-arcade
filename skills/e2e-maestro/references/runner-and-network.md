# The runner, dedicated simulators and the runtime network check

How `npm run e2e:ios -- --app <game-id>` runs every flow on a Release build, on simulators nobody else uses, measures the simulator cold start, memory and 200 % text in the same run, while a sampler proves the app opened no network socket.

## Contents

- What the run needs
- What the runner does
- The cold-start, memory and large-text steps
- Simulator helpers
- Layer F: the runtime network check
- Reports and how to read them
- Passing options to maestro test
- The files

## What the run needs

- A **Release simulator build of the test variant with `ADS_MODE=off`**: `npm run build:ios:sim -- --app <game-id> --variant test --ads off` (the `--ads off` flag sets `ADS_MODE=off` for the whole build; the `ios-simulator-build` skill owns building). Release builds embed the Hermes bundle, so no Metro is running; dev builds legitimately talk to Metro over WebSockets, so the network check is meaningless there. `ADS_MODE=off` never starts the AdMob SDK, which would open sockets legitimately.
- The build at `apps/<game-id>/build/dd/Build/Products/Release-iphonesimulator/*.app` (or `--app-path <.app>`).
- macOS with Xcode 26.6 selected through `DEVELOPER_DIR` when several Xcodes are installed, the iOS 26.5 runtime, Java 17, and the macOS tools `sqlite3` and `footprint` (both ship with macOS).
- For the cold-start step: a test build with the perf layer, installed at Shell step 8 before the E2E step (performance-budgets' `app/perf/` and the shell-native `ProcessStart` module, `markJsEntry()` in `start-shell.ts`, the perf log `createDebugParts` makes with `TEST_ONLY.createPerfLog(saveDriver)`, and Home's `useColdStartMark(useOptionalDebugServices()?.perfLog ?? null)`), and the debug link (`firstRun=0&screen=home`). `check-e2e-setup.mjs .` (rule `perf-layer`) fails while any piece is missing.

## What the runner does

`templates/packages/tooling/src/e2e/run-e2e-ios.ts`:

1. Parses `--app <game-id>` (required), `--sim <purpose>` (the phone steps run on this session's own simulator `e07-<purpose>`, default `e07-e2e-phone`, and the iPad's large-text step on `e07-<purpose>-tablet`, default `e07-e2e-tablet`), `--app-path`, `--flows-only` and `--write-perf-baseline`; every other argument goes to the flows' `maestro test`.
2. Runs `install-maestro.sh` (idempotent, checksum-verified).
3. Reads `CFBundleIdentifier`, the first URL scheme and `CFBundleExecutable` from the app's `Info.plist` (`plutil`).
4. Creates or boots the dedicated simulator `e07-e2e-phone` (or `--sim`'s; iPhone 17 Pro Max, iOS 26.5), installs the app, pins the status bar (9:41, full bars, charged battery), sets the text size to `large` and the appearance to light. When `simctl boot` answers "insufficient system resources" (other sessions' simulators fill the Mac; round 2 hit `maxUserProcs: 2666, runningUserProcs: 2436`), the run stops with what to do: shut down this session's own `e07-*` simulators (`xcrun simctl list devices booted`, then `xcrun simctl shutdown <udid>` for yours), never another session's, or rerun with `--sim <purpose>` on one of yours.
5. Empties `reports/e2e/<game-id>/`, writes an empty `network.txt` and starts the socket sampler as its own process; it runs until every step below is done.
6. **Flows**: `maestro test` on every `packages/shell/e2e/flows/*/*.yaml` and `apps/<game-id>/e2e/flows/*/*.yaml` (sorted) with `--udid`, `--format JUNIT`, `--output reports/e2e/<game-id>/junit.xml`, `--test-output-dir reports/e2e/<game-id>`, `--exclude-tags quarantine,a11y`, `-e APP_ID=...`, `-e APP_SCHEME=...`, and the three no-telemetry variables. The `a11y` flows need `LANG` and 200 % text, so step 9 runs them.
7. **Cold start** and 8. **memory** (`sim-perf-steps.ts`, next section).
9. **Large text** (next section).
10. Kills the sampler. Any failure prints one `e2e:ios: <step>: ...` line and the exit code is 1: a failed flow, a cold-start regression, memory over budget, a failed large-text run, or a non-empty `network.txt` (`network: the app opened non-loopback sockets (spec N3)`). Bad input or a missing build exits 2.

`--flows-only` stops after step 6: fine while iterating, never the evidence run (`check-e2e-report.mjs` then fails with `perf-missing`).

## The cold-start, memory and large-text steps

- **Cold start** (budget `coldStartSimRegressionFactor`, 1.2, in `quality-gates.json` `perf`): terminates the app, launches it and applies `lang=en&...&firstRun=0&screen=home` through `debug-setup.yaml` (`debugSetupArgs`; `simctl openurl` alone leaves iOS's "Open in <app>?" prompt up and the app never gets the link, seen on iOS 26.5), so every later launch lands on Home without a direction reload, waits for that launch's cold-start entry, then 6 times `simctl terminate` + `simctl launch`, each time polling the perf log (`sqlite3 <data>/Documents/SQLite/save.db "SELECT payload FROM perf_log WHERE id = 1"`, every 250 ms, at most 30 s) until an entry newer than the last one appears. `judgeColdStart` drops the first launch and compares the median of the other 5 with `perf-baselines/cold-start-sim-<game-id>.json` (`{ "medianMs": n }`) × 1.2. With no baseline the run writes one (commit it with a `Gate-Change:` trailer); `--write-perf-baseline` rewrites it, which needs the owner when the new median is slower. The whole perf log is saved as `reports/perf/sim-perf-log.json`, the file the performance-budgets check reads with `--sim-baseline`. A timeout means the build has no perf log (not a test build) or Home never called `useColdStartMark`.
- **Memory** (budget `memoryFootprintMbMax`, 150 MB of 1,048,576 bytes): runs the game's `apps/<game-id>/e2e/flows/smoke/*.yaml` again (output in `reports/e2e/<game-id>/memory/`). Maestro 2.10 stops the app when a test ends (verified: after a two-step flow no process is left), so the step then starts it again with `xcrun simctl launch <udid> <bundle id>` (the saved run resumes, as a player's relaunch does), waits for its process on this simulator only (`pgrep -f 'Devices/<udid>/.*\.app/<App>( |$)'` from `appProcessPattern`, every 250 ms, at most 15 s: any bundle folder, because Maestro's `clearState` reinstalls the app as `<bundle id>-<timestamp>.app`, where the older `<App>.app/<App>` pattern found nothing), lets it settle for 10 s, and reads `phys_footprint` from `footprint --pid <pid> -j memory/footprint.json -f bytes --noCategories` (no `sudo` needed for simulator apps; verified). `measureMemory(input, budgets, ops)` takes the simulator operations as a parameter; `sim-perf-steps.test.ts` proves the order (smoke flows, relaunch, pid, settle, footprint) and that a failed flow or an app that does not start again never measures.
- Both results go to `reports/e2e/<game-id>/perf.json`: `{ coldStart: { launchesMs, medianMs, baselineMs, limitMs, isRegression } | { error }, memory: { physFootprintBytes, physFootprintMb, limitMb, isOver } | { error } }`.
- **Large text**: every `flows/a11y/*.yaml` of the Shell and the game, `--include-tags a11y`, at `accessibility-extra-extra-extra-large`, with `-e LANG=en` and `-e LANG=fa`, first on `e07-e2e-phone`, then on `e07-e2e-tablet` (iPad Pro 13-inch (M5), created on first use; the phone's app is stopped first because the sampler follows one running copy). Reports and screenshots go to `reports/e2e/<game-id>/large-text/<phone|tablet>-<en|fa>/`; open every screenshot with the Read tool. The text size is reset to `large` afterwards.

Verified against a probe Release build: flow discovery by area folder, tag pass-through, JUnit output and the exit code.

## Simulator helpers

`templates/packages/tooling/src/e2e/simulator.ts`:

- `ensureSimulator(name, model)`: finds the simulator by name on the iOS 26.5 runtime or creates it, boots it and waits (`simctl bootstatus -b`). Only dedicated, named simulators are used: `e07-e2e-phone`, `e07-e2e-tablet`, `e07-shots-phone`, `e07-shots-tablet`, or this session's own `e07-<purpose>` from `--sim` (`e2eSimulatorName`). Never `booted` and never another agent's simulator. A boot refused for lack of resources throws `bootFailureMessage(name, text)` (shut down your own `e07-*` simulators, never another session's). Both helpers are tested in `simulator.test.ts`.
- `prepareSimulator(udid, app, textSize)`: `simctl install`, `status_bar ... override --time 9:41 ...`, `setTextSize` (`ui <udid> content_size <size>`).
- `terminateApp`, `launchApp`, `debugSetupArgs(run)` (the `maestro test` arguments that apply one debug link through `debug-setup.yaml` and wait for a testID; never `simctl openurl`, whose prompt nobody accepts), `appDataDir` (`get_app_container ... data`), `appPidOn(udid, appName)`, `runMaestro(args)` and `appEnv(app)` (the two `-e` values every flow reads). Verified on an iOS 26.5 simulator: launch, the udid-scoped pid, `footprint`, terminate and the data folder.
- `setAppearance(udid, 'light' | 'dark')`, `readAppInfo(appPath)`, `findSimulatorBuild(game, override)`.
- `maestroEnv()`: Java 17 and the three `MAESTRO_*` variables.

Shut down simulators you created when the session ends (`xcrun simctl shutdown <udid>`); erase one (`xcrun simctl erase <udid>`) when its state looks wrong.

## Layer F: the runtime network check

Spec N3: the app's own code makes no network requests; only AdMob and StoreKit may use the network. Static layers (lint, bundle, native modules, pods, config) are the privacy audit's work; layer F watches the running app:

1. **The JS network guard** (test builds only) counts every `fetch`, XHR and WebSocket attempt; every smoke flow asserts `debug.network-attempts` shows `0`.
2. **Socket sampling.** `sample-sockets.ts <AppName> <report>` runs as its own process (the runner blocks on `spawnSync(maestro)`) and once per second finds the app's process (`pgrep -f '\.app/<App>( |$)'`, `appProcessPattern`: any bundle folder, since Maestro's `clearState` reinstall renames it `<bundle id>-<timestamp>.app`; the older `<App>.app/<App>` pattern found no process after the first flow, so round 2's empty `network.txt` proved nothing for those flows) and lists its sockets (`lsof -nP -i -a -p <pid>`); every connected line (`->`) whose peer is not loopback (`127.*`, `[::1]`, `localhost`) is appended to `network.txt`. `lsof` works without `sudo` on simulator processes. StoreKit traffic runs in system daemons and is invisible here (and allowed anyway).

`network-runtime-layer.ts` holds the pure parser (`nonLoopbackConnections`) and its test; iOS simulators have no airplane mode, so `offline=1` plus these two measurements are the airplane-mode test of spec 15.2 on iOS.

## Reports and how to read them

| File | What it says |
|---|---|
| `reports/e2e/<game-id>/junit.xml` | one `<testcase>` per flow: `name` (the flow's `name:`), `file`, `status` (`SUCCESS`, `WARNING`, `ERROR`, ...), the tags, and a `<failure>` such as `Assertion is false: id: home.screen is visible` |
| `reports/e2e/<game-id>/network.txt` | empty = the sampler ran and saw nothing; each line is a socket the app opened |
| `reports/e2e/<game-id>/perf.json` | the cold-start and memory results, or each step's error |
| `reports/e2e/<game-id>/large-text/<device>-<lang>/` | JUnit, log and screenshots of the a11y flows at 200 % text |
| `reports/perf/sim-perf-log.json` | the simulator perf log after the cold-start step |
| `reports/e2e/<game-id>/<timestamp>/<flow name>/` | per-flow command log and screenshots, `xctest_runner_*.log` |

`node ${CLAUDE_SKILL_DIR}/scripts/check-e2e-report.mjs . --app <game-id>` reads them, fails on any failed flow, a smoke flow that did not run, a missing or non-empty `network.txt`, a missing `perf.json`, a cold-start regression, memory over budget, and a missing or failed large-text run, and prints the evidence lines ("End-to-end: 7/7 flows pass, quarantined: none", "Network: ... no non-loopback sockets", "Cold start (simulator): median 651 ms of 5 launches, baseline 648 ms, limit 778 ms", "Memory (simulator): phys_footprint 94 MB after the smoke flow and a relaunch (budget 150 MB)", "Large text: 4/4 a11y flow runs pass at 200 % ..."). A cold-start error points at the perf layer (`check-e2e-setup` rule `perf-layer`); a memory error "the app is not running" or "did not start again" points at the relaunch.

## Passing options to maestro test

Extra arguments go straight to the flows' `maestro test`: `npm run e2e:ios -- --app line-siege --flows-only --include-tags smoke` runs only smoke flows and skips the measurements (fine while iterating; the evidence run has no filter and no `--flows-only`). The runner passes `--exclude-tags quarantine,a11y` itself.

## The files

| Template | Path in the repo |
|---|---|
| `install-maestro.sh` | `packages/tooling/scripts/install-maestro.sh` |
| `run-e2e-ios.ts`, `sim-perf-steps.ts` (+ test), `sim-perf.ts` (+ test), `simulator.ts` (+ test), `write-gallery.ts`, `capture-screenshots-ios.ts`, `print-level-line.ts` with `level-line.ts` (+ test) | `packages/tooling/src/e2e/` |
| `compare-png.ts` | `packages/tooling/src/visual/` |
| `network-runtime-layer.ts` (+ test), `sample-sockets.ts` | `packages/tooling/src/audit/` |
| The debug kit: `network-guard.ts`, `simulated-connectivity.ts`, `simulated-clock.ts`, `debug-services.ts`, `debug-overrides.ts`, `fake-debug-store.ts`, `debug-link.ts`, `debug-save-recipe.ts`, `debug-save-import.ts`, `debug-tools.ts`, `debug-sheets.ts`, `debug-actions.ts`, `use-debug-model.ts` (+ tests) | `packages/shell/src/screens/debug/` (test-only, reached through `test-only.ts`) |
| `debug-link-handler.ts`, `debug-link-intake.ts`, `debug-link-routes.ts`, `create-debug-parts.ts`, `debug-services-context.tsx` (+ tests) | `packages/shell/src/app/` (the handler through `test-only.ts`; the parts and the context in every build, with type-only debug imports) |
| `sqlite-kv-debug-store-adapter.ts` (its test: `test/integration/save/sqlite-kv-debug-store-adapter.test.ts`) | `packages/shell/src/services/save/` (through `test-only.ts`) |

The tooling files run under Node's type stripping (`node packages/tooling/src/e2e/run-e2e-ios.ts`), import each other by `@e07/tooling/...` names, and pass `tsc`, ESLint and Prettier with the repo config (verified). The npm scripts:

```json
{
  "e2e:ios": "node packages/tooling/src/e2e/run-e2e-ios.ts",
  "screenshots:ios": "node packages/tooling/src/e2e/capture-screenshots-ios.ts"
}
```
