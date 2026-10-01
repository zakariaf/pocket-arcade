# The runner, dedicated simulators and the runtime network check

How `npm run e2e:ios -- --app <game-id>` runs every flow on a Release build, on simulators nobody else uses, measures the simulator cold start, memory and 200 % text in the same run, while a sampler proves the app opened no network socket.

## Contents

- What the run needs
- What the runner does
- One simulator, one driver port: maestro-args
- The cold-start, memory and large-text steps
- Simulator helpers
- Layer F: the runtime network check
- Reports and how to read them
- Passing options to maestro test
- The files

## What the run needs

- A **Release simulator build of the test variant with `ADS_MODE=off`**: `npm run build:ios:sim -- --app <game-id> --variant test --ads off` (the `--ads off` flag sets `ADS_MODE=off` for the whole build; the `ios-simulator-build` skill owns building). Release builds embed the Hermes bundle, so no Metro is running; dev builds legitimately talk to Metro over WebSockets, so the network check is meaningless there. `ADS_MODE=off` never starts the AdMob SDK, which would open sockets legitimately, and the consent flow then asks neither Google's form nor Apple's App Tracking Transparency prompt (owner decision O1: the app asks ATT only before an ad request, and never with ads off), so no system prompt covers a screen. The runner refuses any other build before it touches the simulator (`requireAdsOffTestBuild`: it reads `EXConstants.bundle/app.config` and stops with `e2e:ios needs a test build with ADS_MODE=off, this one is <variant>/<ads>`; `check-e2e-setup` rule `e2e-ads-off`). The ATT prompt order (S3, Google's form, then Apple's prompt) is proven in an `ADS_MODE=test` build by admob-ads' device check, never in E2E.
- The build at `apps/<game-id>/build/dd/Build/Products/Release-iphonesimulator/*.app` (or `--app-path <.app>`).
- macOS with Xcode 26.6 selected through `DEVELOPER_DIR` when several Xcodes are installed, the iOS 26.5 runtime, Java 17, and the macOS tools `sqlite3` and `footprint` (both ship with macOS).
- For the cold-start step: a test build with the perf layer, installed at Shell step 8 before the E2E step (performance-budgets' `app/perf/` and the shell-native `ProcessStart` module, `markJsEntry()` in `start-shell.ts`, the perf log `createDebugParts` makes with `TEST_ONLY.createPerfLog(saveDriver)`, and Home's `useColdStartMark(useOptionalDebugServices()?.perfLog ?? null)`), and the debug link (`firstRun=0&screen=home`). `check-e2e-setup.mjs .` (rule `perf-layer`) fails while any piece is missing.

## What the runner does

`templates/packages/tooling/src/e2e/run-e2e-ios.ts`:

1. Parses the command line (`e2e-cli.ts`, pure, with its test): `--app <game-id>` (required), `--sim <purpose>` (the phone steps run on this session's own simulator `e07-<purpose>`, default `e07-e2e-phone`, and the iPad's large-text step on `e07-<purpose>-tablet`, default `e07-e2e-tablet`), `--driver-port <n>` (this session's own Maestro driver port for every run; without it each run takes a free one), `--app-path`, `--flows-only`, `--write-perf-baseline`, and `--include-tags <tags>`, which goes to the flows' `maestro test`. `npm run e2e:ios -- --help` (or `-h`) prints every option and exits 0; an unknown option, a stray argument, a missing `--app` or a bad `--driver-port` prints the message and the usage line and exits 2, without a stack (round 4: `--help` threw "Error: usage: ..." with a Node stack).
2. Runs `install-maestro.sh` (idempotent, checksum-verified).
3. Refuses a build that is not test/off (`requireAdsOffTestBuild`), then reads `CFBundleIdentifier`, the first URL scheme and `CFBundleExecutable` from the app's `Info.plist` (`plutil`).
4. Creates or boots the dedicated simulator `e07-e2e-phone` (or `--sim`'s; iPhone 17 Pro Max, iOS 26.5), installs the app, pins the status bar (9:41, full bars, charged battery), sets the text size to `large` and the appearance to light. When `simctl boot` answers "insufficient system resources" (other sessions' simulators fill the Mac; round 2 hit `maxUserProcs: 2666, runningUserProcs: 2436`), the run stops with what to do: shut down this session's own `e07-*` simulators (`xcrun simctl list devices booted`, then `xcrun simctl shutdown <udid>` for yours), never another session's, or rerun with `--sim <purpose>` on one of yours.
5. Empties `reports/e2e/<game-id>/`, writes an empty `network.txt` and starts the socket sampler for the phone as its own process (`socketSamplers().watch(udid)`); the large-text step starts a second one for the iPad. They run until every step below is done.
6. **Flows**: `maestro --device <udid> --driver-host-port <port> test` (next section) on every `packages/shell/e2e/flows/*/*.yaml` and `apps/<game-id>/e2e/flows/*/*.yaml` (sorted: the game's flows first, the Shell's after them, `smoke/04-debug-performance.yaml` last) with `--format JUNIT`, `--output reports/e2e/<game-id>/junit.xml`, `--test-output-dir reports/e2e/<game-id>`, `--exclude-tags quarantine,a11y`, `-e APP_ID=...`, `-e APP_SCHEME=...`, and the three no-telemetry variables. The `a11y` flows need `LANG` and 200 % text, so step 9 runs them. Right after the flows (before any later `clearState`), `recordSaveBenchmark` reads the perf log and writes `save-benchmark.json`: the newest `save-benchmark` entry S15's "Run save benchmark" left (`save-benchmark-evidence.ts`). The runner never runs `packages/shell/e2e/ads-smoke/` (admob-ads' hand-run ads smoke flows need an `ADS_MODE=test` build).
7. **Cold start** and 8. **memory** (`sim-perf-steps.ts`, next section).
9. **Large text** (next section).
10. Kills the sampler. Any failure prints one `e2e:ios: <step>: ...` line and the exit code is 1: a failed flow, a cold-start regression, memory over budget, a failed large-text run, or a non-empty `network.txt` (`network: the app opened non-loopback sockets (spec N3)`). Bad input or a missing build exits 2.

`--flows-only` stops after step 6: fine while iterating, never the evidence run (`check-e2e-report.mjs` then fails with `perf-missing`).

## One simulator, one driver port: maestro-args

Several sessions share one Mac. Maestro's per-command `--udid` picks the simulator but leaves the XCTest driver on its default host port 7001, and a second session's driver on that port can answer: in round 3 a `maestro hierarchy` call returned another session's Persian Settings screen. So every Maestro run of the repo tooling starts with the global options, before the command:

```sh
tools/maestro/bin/maestro --device <udid> --driver-host-port <port> test <flow> ...
```

- `templates/packages/tooling/src/e2e/maestro-args.ts` (a shared file; the same bytes ship in ios-simulator-build and premium-purchase): `maestroGlobalArgs({ udid, driverPort })` returns `['--device', udid, '--driver-host-port', String(driverPort)]` and refuses `booted`, a simulator name, a list or a port outside 1024-65535; `freeDriverPort()` asks the system for a free port (listen on port 0, then release it); `driverPortFor(given)` keeps a session's `--driver-port` or picks a free one; `maestroRunLine(target, command)` is the log line.
- `simulator.ts`'s `runMaestro({ udid, driverPort? }, args)` is the one spawn of the binary in e2e-maestro's tooling: it takes a free port per run unless the session passed one, prints `maestro: device <udid>, driver port <port>: test <flow>`, and runs `maestro <global options> <args>`. `debugSetupArgs`, the flows, the memory step, the large-text step and `capture-screenshots-ios.ts` all go through it; none of them passes `--udid`.
- Every `xcrun simctl` call names the UDID the runner got from `ensureSimulator` (never `booted`), and the build uses `-destination id=<udid>`.
- `check-e2e-setup` rule `maestro-device` (and ios-simulator-build's `check-sim-setup`) fails any spawn of the Maestro binary under `packages/tooling/src` whose arguments neither come from `maestroGlobalArgs` nor put `--device` and `--driver-host-port` before the command, any `'--udid'`, and any fixed port (`'--driver-host-port', '7001'`, `driverPort: 7001`).
- Verified on the simulator: with a second simulator of this session booted and running its own Maestro driver on another port, a full evidence run named only its own UDID in every `maestro:` line, the JUnit report and the per-flow logs, and each run used a different free port.

## The cold-start, memory and large-text steps

- **Cold start** (budget `coldStartSimRegressionFactor`, 1.2, in `quality-gates.json` `perf`): terminates the app, launches it and applies `lang=en&...&firstRun=0&screen=home` through `debug-setup.yaml` (`debugSetupArgs`; `simctl openurl` alone leaves iOS's "Open in <app>?" prompt up and the app never gets the link, seen on iOS 26.5), so every later launch lands on Home without a direction reload, waits for that launch's cold-start entry, then 6 times `simctl terminate` + `simctl launch`, each time polling the perf log (`sqlite3 <data>/Documents/SQLite/save.db "SELECT payload FROM perf_log WHERE id = 1"`, every 250 ms, at most 30 s) until an entry newer than the last one appears. `judgeColdStart` drops the first launch and compares the median of the other 5 with `perf-baselines/cold-start-sim-<game-id>.json` (`{ "medianMs": n }`) × 1.2. With no baseline the run writes one (commit it with a `Gate-Change:` trailer); `--write-perf-baseline` rewrites it, which needs the owner when the new median is slower. The whole perf log is saved as `reports/perf/sim-perf-log.json`, the file the performance-budgets check reads with `--sim-baseline`. A timeout means the build has no perf log (not a test build) or Home never called `useColdStartMark`.
- **Memory** (budget `memoryFootprintMbMax`, 150 MB of 1,048,576 bytes): runs the game's `apps/<game-id>/e2e/flows/smoke/*.yaml` again (output in `reports/e2e/<game-id>/memory/`), then reads the perf log the flows left and writes `reports/e2e/<game-id>/feedback.json` (`feedback-evidence.ts`: `{ flows, sounds, haptics }`; next bullet). Maestro 2.10 stops the app when a test ends (verified: after a two-step flow no process is left), so the step then starts it again with `xcrun simctl launch <udid> <bundle id>` (the saved run resumes, as a player's relaunch does), waits for its process on this simulator only (`pgrep -f 'Devices/<udid>/.*\.app/<App>( |$)'` from `appProcessPattern`, every 250 ms, at most 15 s: any bundle folder, because Maestro's `clearState` reinstalls the app as `<bundle id>-<timestamp>.app`, where the older `<App>.app/<App>` pattern found nothing), lets it settle for 10 s, and reads `phys_footprint` from `footprint --pid <pid> -j memory/footprint.json -f bytes --noCategories` (no `sudo` needed for simulator apps; verified). `measureMemory(input, budgets, ops)` takes the simulator operations as a parameter; `sim-perf-steps.test.ts` proves the order (smoke flows, relaunch, pid, settle, footprint) and that a failed flow or an app that does not start again never measures.
- **Feedback evidence** (owner decision O6 keeps how it sounds and feels the owner's own check; this proves the app asked for it on the simulator): in test builds `createDebugParts` wraps the audio and haptics ports with game-audio-and-haptics' recorders (`TEST_ONLY.recordAudioFeedback`, `recordHapticsFeedback` from `services/audio/recording-feedback.ts`), so every sound and pulse the Shell's feedback asks for also appends `{ kind: 'feedback', label: <sound id or haptic cue> }` to the perf log, and still reaches the real port. After the level-1 flow's `action=win-level` the log holds `ui.win` and `success`; `check-e2e-report` rule `feedback-evidence` requires both. Store builds contain none of this code (the recorders live behind the test-only entry).
- Both results go to `reports/e2e/<game-id>/perf.json`: `{ coldStart: { launchesMs, medianMs, baselineMs, limitMs, isRegression } | { error }, memory: { physFootprintBytes, physFootprintMb, limitMb, isOver } | { error } }`.
- **Large text**: every `flows/a11y/*.yaml` of the Shell and the game, `--include-tags a11y`, at `accessibility-extra-extra-extra-large`, with `-e LANG=en` and `-e LANG=fa`, first on `e07-e2e-phone`, then on `e07-e2e-tablet` (iPad Pro 13-inch (M5), created on first use; the phone's app is stopped first because the sampler follows one running copy). Reports and screenshots go to `reports/e2e/<game-id>/large-text/<phone|tablet>-<en|fa>/`; open every screenshot with the Read tool. The text size is reset to `large` afterwards.

Verified against a probe Release build: flow discovery by area folder, tag pass-through, JUnit output and the exit code.

## Simulator helpers

`templates/packages/tooling/src/e2e/simulator.ts`:

- `ensureSimulator(name, model)`: finds the simulator by name on the iOS 26.5 runtime or creates it, boots it and waits (`simctl bootstatus -b`). Only dedicated, named simulators are used: `e07-e2e-phone`, `e07-e2e-tablet`, `e07-shots-phone`, `e07-shots-tablet`, or this session's own `e07-<purpose>` from `--sim` (`e2eSimulatorName`). Never `booted` and never another agent's simulator. A boot refused for lack of resources throws `bootFailureMessage(name, text)` (shut down your own `e07-*` simulators, never another session's). Both helpers are tested in `simulator.test.ts`.
- `prepareSimulator(udid, app, textSize)`: `simctl install`, `status_bar ... override --time 9:41 ...`, `setTextSize` (`ui <udid> content_size <size>`).
- `terminateApp`, `launchApp`, `debugSetupArgs(run)` (the `test` command's arguments that apply one debug link through `debug-setup.yaml` and wait for a testID, run through `runMaestro`; never `simctl openurl`, whose prompt nobody accepts), `appDataDir` (`get_app_container ... data`), `appPidOn(udid, appName)`, `runMaestro(device, args)` (the device and a driver port first: previous section) and `appEnv(app)` (the two `-e` values every flow reads), `e2eBuildProblem` and `requireAdsOffTestBuild` (test variant with ads off only). Verified on an iOS 26.5 simulator: launch, the udid-scoped pid, `footprint`, terminate and the data folder.
- `setAppearance(udid, 'light' | 'dark')`, `readAppInfo(appPath)`, `findSimulatorBuild(game, override)`.
- `maestroEnv()`: Java 17 and the three `MAESTRO_*` variables.

Shut down simulators you created when the session ends (`xcrun simctl shutdown <udid>`); erase one (`xcrun simctl erase <udid>`) when its state looks wrong.

## Layer F: the runtime network check

Spec N3: the app's own code makes no network requests; only AdMob and StoreKit may use the network. Static layers (lint, bundle, native modules, pods, config) are the privacy audit's work; layer F watches the running app:

1. **The JS network guard** (test builds only) counts every `fetch`, XHR and WebSocket attempt; every smoke flow asserts `debug.network-attempts` shows `0`.
2. **Socket sampling.** `sample-sockets.ts <AppName> <report> <udid>...` runs as its own process, one per simulator of the run (the runner blocks on `spawnSync(maestro)`), and once per second finds the app's process on that simulator only (`pgrep -f 'Devices/<udid>/.*\.app/<App>( |$)'`, `appProcessPatterns(appName, udids)`; a sampler without a UDID refuses to start). Other sessions run the same app on their own simulators, an `ADS_MODE=test` build among them whose Google sockets are legitimate there: on 2026-10-01 a sampler that watched every copy on the Mac filled this run's `network.txt` with another session's QUIC and TCP sockets to Google (`UDP ...->142.251.x.x:443`) while every flow here passed; check-e2e-setup's `sampler-own-simulators` refuses that runner. The pattern accepts any bundle folder (`appProcessPattern`: any bundle folder, since Maestro's `clearState` reinstall renames it `<bundle id>-<timestamp>.app`; the older `<App>.app/<App>` pattern found no process after the first flow, so round 2's empty `network.txt` proved nothing for those flows) and lists its sockets (`lsof -nP -i -a -p <pid>`); every connected line (`->`) whose peer is not loopback (`127.*`, `[::1]`, `localhost`) is appended to `network.txt`. `lsof` works without `sudo` on simulator processes. StoreKit traffic runs in system daemons and is invisible here (and allowed anyway).

`network-runtime-layer.ts` holds the pure parser (`nonLoopbackConnections`) and its test; iOS simulators have no airplane mode, so `offline=1` plus these two measurements are the airplane-mode test of spec 15.2 on iOS.

## Reports and how to read them

| File | What it says |
|---|---|
| `reports/e2e/<game-id>/junit.xml` | one `<testcase>` per flow: `name` (the flow's `name:`), `file`, `status` (`SUCCESS`, `WARNING`, `ERROR`, ...), the tags, and a `<failure>` such as `Assertion is false: id: home.screen is visible` |
| `reports/e2e/<game-id>/network.txt` | empty = the sampler ran and saw nothing; each line is a socket the app opened |
| `reports/e2e/<game-id>/perf.json` | the cold-start and memory results, or each step's error |
| `reports/e2e/<game-id>/feedback.json` | the sounds and haptic cues the game's smoke flows asked for (`ui.win` and `success` after the win) |
| `reports/e2e/<game-id>/save-benchmark.json` | `{ flows, entry }`: the S15 save benchmark of the flows step, `entry.data` = `{ p50, p95, max, writes }` in ms (null when no flow ran it) |
| `reports/e2e/<game-id>/large-text/<device>-<lang>/` | JUnit, log and screenshots of the a11y flows at 200 % text |
| `reports/perf/sim-perf-log.json` | the simulator perf log after the cold-start step |
| `reports/e2e/<game-id>/<timestamp>/<flow name>/` | per-flow command log and screenshots, `xctest_runner_*.log` |

`node ${CLAUDE_SKILL_DIR}/scripts/check-e2e-report.mjs . --app <game-id>` reads them, fails on any failed flow, a smoke flow that did not run, a missing or non-empty `network.txt`, a missing `perf.json`, a cold-start regression, memory over budget, a missing `feedback.json` or one without the win sound and the success haptic (`feedback-evidence`), no save benchmark, one with other than 300 writes or a p95 not under the 5 ms budget (`save-benchmark`), and a missing or failed large-text run, and prints the evidence lines ("Feedback (simulator): the win asked for sound ui.win and the success haptic ...", "Save benchmark (simulator, S15): 300 writes, p95 0.41 ms (budget under 5 ms) ...", "End-to-end: 7/7 flows pass, quarantined: none", "Network: ... no non-loopback sockets", "Cold start (simulator): median 651 ms of 5 launches, baseline 648 ms, limit 778 ms", "Memory (simulator): phys_footprint 94 MB after the smoke flow and a relaunch (budget 150 MB)", "Large text: 4/4 a11y flow runs pass at 200 % ..."). A cold-start error points at the perf layer (`check-e2e-setup` rule `perf-layer`); a memory error "the app is not running" or "did not start again" points at the relaunch.

## Passing options to maestro test

`--include-tags <tags>` goes straight to the flows' `test` command (after the global `--device` and `--driver-host-port`): `npm run e2e:ios -- --app line-siege --flows-only --include-tags smoke` runs only smoke flows and skips the measurements (fine while iterating; the evidence run has no filter and no `--flows-only`). The runner passes `--exclude-tags quarantine,a11y` itself; any other option is refused (exit 2), so a typo never silently changes the run. One flow by hand: `tools/maestro/bin/maestro --device <udid> --driver-host-port <port> test <flow> -e APP_ID=<id> -e APP_SCHEME=<scheme>`.

## The files

| Template | Path in the repo |
|---|---|
| `install-maestro.sh` | `packages/tooling/scripts/install-maestro.sh` |
| `run-e2e-ios.ts`, `e2e-cli.ts` (+ test), `sim-perf-steps.ts` (+ test), `sim-perf.ts` (+ test), `simulator.ts` (+ test), `maestro-args.ts` (+ test), `feedback-evidence.ts` (+ test), `save-benchmark-evidence.ts` (+ test), `write-gallery.ts`, `capture-screenshots-ios.ts`, `print-level-line.ts` with `level-line.ts` (+ test) | `packages/tooling/src/e2e/` |
| `compare-png.ts` | `packages/tooling/src/visual/` |
| `network-runtime-layer.ts` (+ test), `sample-sockets.ts` | `packages/tooling/src/audit/` |
| The debug kit: `network-guard.ts`, `simulated-connectivity.ts`, `simulated-clock.ts`, `debug-services.ts`, `debug-overrides.ts`, `fake-debug-store.ts`, `debug-link.ts`, `debug-save-recipe.ts`, `debug-save-import.ts`, `debug-tools.ts`, `debug-sheets.ts`, `debug-actions.ts`, `debug-perf.ts`, `fake-debug-perf.ts`, `use-debug-model.ts` (+ tests) | `packages/shell/src/screens/debug/` (test-only, reached through `test-only.ts`) |
| `debug-link-handler.ts`, `debug-link-intake.ts`, `debug-link-routes.ts`, `create-debug-parts.ts`, `debug-services-context.tsx` (+ tests) | `packages/shell/src/app/` (the handler through `test-only.ts`; the parts and the context in every build, with type-only debug imports) |
| `sqlite-kv-debug-store-adapter.ts` (its test: `test/integration/save/sqlite-kv-debug-store-adapter.test.ts`) | `packages/shell/src/services/save/` (through `test-only.ts`) |

The tooling files run under Node's type stripping (`node packages/tooling/src/e2e/run-e2e-ios.ts`), import each other by `@e07/tooling/...` names, and pass `tsc`, ESLint and Prettier with the repo config (verified). The npm scripts:

```json
{
  "e2e:ios": "node packages/tooling/src/e2e/run-e2e-ios.ts",
  "screenshots:ios": "node packages/tooling/src/e2e/capture-screenshots-ios.ts"
}
```
