# Measuring: frame times, cold start, save writes, draw calls, bundle and memory

How each budget is measured, what the templates do, and the exact commands.

## Contents

- Frame-time recorder
- The perf log and the shared report
- Cold-start log
- Save-write performance
- Draw-call budget
- Bundle size
- Memory footprint
- The owner's steps

## Frame-time recorder

Files: `frame-histogram.ts`, `frame-report.ts`, `use-frame-recorder.ts` (templates, with tests), in `packages/shell/src/app/perf/`.

- The histogram is a small immutable record: 7 buckets bounded at 9 / 17 / 25 / 34 / 50 / 100 ms and above, plus frames, total, min, max, and hitch time at both 120 Hz and 60 Hz. `recordFrame` is a pure worklet.
- Hitch time is Σ max(0, dt − frame budget); the hitch rate is hitch time per recorded second (Apple's metric). The report picks 120 Hz when the shortest interval is under 12 ms, otherwise 60 Hz. ProMotion needs `ios.infoPlist.CADisableMinimumFrameDurationOnPhone: true`, set by `withShell` (`packages/shell/src/config/with-shell.ts`); without it iOS caps a third-party app at 60 fps and a device report shows `refreshHz: 60` on a ProMotion phone. `check-perf-code.mjs` fails a `with-shell.ts` without it. Reanimated 4.5.1 and Worklets 0.10.1 already request 120 fps from `CADisplayLink`; the plist key is the only switch.
- **The recorder never owns a frame callback.** The board host's existing callback calls `sampleFrame(histogram, isRecording, frameInfo.timeSincePreviousFrame)` as the first statement inside the `try` of its frame runners (`runBoardFrame`, `runLoopFrame`). An extra display link would keep an idle screen rendering and change what it measures.
- It is off until switched on in the debug menu; in a store build `isRecording` stays false, so `sampleFrame` returns after one read. The debug-menu pieces (the switch, `createPerfLog`, `sharePerfReport`, the save benchmark) are test-only code, reached only through the test-only entry, so the store bundle does not contain them.
- On level end, pause, background or blur, the JS side calls `recorder.stop()`, which returns a `FrameReport` (or null when no frame ran), and appends it to the perf log.

## The perf log and the shared report

- `createPerfLog(driver)` (test builds only) keeps one JSON row in the save database: table `perf_log`, ring buffer of the last 200 entries, outside the save slots and outside the save migrations.
- An entry: `{ "kind": "frames" | "cold-start" | "save-benchmark", "label", "atEpochMs", "data" }`, for example:

```json
{ "kind": "frames", "label": "line-siege/level-12", "atEpochMs": 1790430000000,
  "data": { "frames": 1440, "seconds": 12.1, "refreshHz": 120, "p50UpToMs": 9, "p95UpToMs": 17,
            "maxMs": 41, "hitchMsPerS": 3.2, "buckets": [1300, 110, 20, 7, 3, 0, 0] } }
```

- `p50UpToMs` / `p95UpToMs` are bucket upper bounds (9, 17, 25, 34, 50, 100); a percentile in the slowest bucket is `Infinity`, which JSON writes as `null`, and `check-perf-report.mjs` fails it.
- `sharePerfReport(log, header)` opens the iOS share sheet with `{ appId, appVersion, buildNumber, deviceModel, entries }`. Performance data stays on the phone and leaves only through the share sheet: the app itself sends nothing.
- On the simulator Claude reads the row directly:

```sh
DATA=$(xcrun simctl get_app_container "$UDID" "$BUNDLE_ID" data)
sqlite3 "$DATA/Documents/SQLite/save.db" "SELECT payload FROM perf_log WHERE id = 1" > reports/perf/sim-perf-log.json
```

- `check-perf-report.mjs <report.json>` judges either form against the budgets.

## Cold-start log

- **Why a native module:** React Native's own startup marks begin when the JS bundle starts loading, not when the process starts. Measured on the simulator (66 cold launches of a probe app): process start -> first frame had a median of 539 ms, and 484 ms of it passed before the app's JS module ran; JS then took a median of 30 ms. JS-only timing would miss about 90 % of the cold start.
- `packages/shell/ios/ProcessStartModule.swift` (template) reads the process start time from the kernel (`sysctl KERN_PROC_PID`, `p_starttime`) as epoch ms; `packages/shell/expo-module.config.json` and `packages/shell/ios/E07Shell.podspec` make the Shell an Expo module package (autolinking found the pod `E07Shell` and the Swift code compiled and ran in a Release simulator build). `process-start.ts` returns null in Jest, on Android until ported, or on a sysctl failure.
- `markJsEntry()` runs once in `startShell` (`start-shell.ts`), right after `readParityLaunch()`, never at module scope (a pure in-memory mark; after a direction reload the new runtime marks again).
- Home calls `useColdStartMark(perfLog)` once its data is on screen: one frame later (`requestAnimationFrame`) it records `{ nativeMs, jsMs, totalMs }` once per process. `perfLog` is null in store builds.

### When the layer is installed, and who wires what

The cold-start layer is installed at **Shell step 8**, together with the native plugin list (`packages/shell/src/config/shell-plugins.ts`): the Swift module needs a native rebuild anyway, and the step-10 E2E evidence run measures cold start, so it must exist before the first E2E run. Installing it later (it used to be step 11) makes `npm run e2e:ios` fail its cold-start step with "no new cold-start entry within 30 s". This skill ships the files; three other skills own the lines that connect them:

| Piece | File | Owner | What it does |
|---|---|---|---|
| The shell-native module | `packages/shell/expo-module.config.json`, `packages/shell/ios/E07Shell.podspec`, `packages/shell/ios/ProcessStartModule.swift` | this skill (`templates/shell-native/`) | the process start time |
| The perf layer | `packages/shell/src/app/perf/` (every file of `templates/shell-perf/`) | this skill | marks, perf log, recorder, benchmark, share |
| The JS entry mark | `packages/shell/src/app/start-shell.ts`: `markJsEntry()` inside `startShell`, right after `readParityLaunch()` | rtl-and-direction | the first JS timestamp of the launch |
| The perf log | `packages/shell/src/app/create-debug-parts.ts`: `TEST_ONLY.createPerfLog(saveDriver)`, exposed on `DebugServices` as `perfLog` | e2e-maestro | test builds keep the log in `save.db`; store builds have no debug parts |
| The test-only member | `createPerfLog` in the shared test-only pair (`test-only-api.ts`, `test-only-entry.ts`) | e2e-maestro (the pair's one editor) | joins once `perf-log.ts` exists |
| The Home mark | `packages/shell/src/screens/home/use-home-model.ts`: `useColdStartMark(useOptionalDebugServices()?.perfLog ?? null)` | toybox-screens | the cold-start entry, null in store builds |

`check-perf-code.mjs` rule `perf-layer` fails while any of these is missing once the plugin list exists (before that it prints a `SKIP` line; the Home mark skips while S4 is outside `shell-slice.json`, everything with `"screens": []`), and e2e-maestro's `check-e2e-setup.mjs` fails on the same gaps before an E2E run. The app/perf files belong to the Shell core of every slice: the composition root and the debug kit import them.
- A launch that flips the layout direction and reloads is slower by design: label those runs and leave them out of the budget.
- **Simulator run** (Release test build, after the smoke flows): `npm run e2e:ios -- --app <game>` does this in its cold-start step (the e2e-maestro runner; results in `reports/e2e/<game>/perf.json`): it opens Home through the debug link, then 6 times `xcrun simctl terminate <udid> <bundleId>`, `xcrun simctl launch <udid> <bundleId>` and a wait until the perf log has a newer `cold-start` entry (read with the `sqlite3` command above), saves the payload as `reports/perf/sim-perf-log.json`, and writes the baseline on the first run. By hand, the same payload is judged with `node ${CLAUDE_SKILL_DIR}/scripts/check-perf-report.mjs reports/perf/sim-perf-log.json --root . --sim-baseline <medianMs>`: it takes the latest 6 launches, drops the first as warm-up, and compares the median of the other 5 with the baseline × `coldStartSimRegressionFactor` (1.2); no frames entry is needed. The baseline is committed as `perf-baselines/cold-start-sim-<game>.json` = `{ "medianMs": <n> }`: the first accepted run writes it; a slower new baseline needs the owner's approval and a `Gate-Change:` trailer. Reference: host `simctl launch` -> first frame median 648 ms; process start -> first frame median 539 ms.
- The perf log survives app updates (it is a ring buffer of 200 entries in `save.db`), so `check-perf-report.mjs` judges only the latest 5 cold starts of a device report (`--min-launches`); the owner's 5 relaunches must be the last launches before sharing.

## Save-write performance

- **Jest guard** (`test/integration/save/save-write.perf.test.ts`, template): the real save store on Node's built-in `node:sqlite` driver, WAL with `synchronous = FULL`, the largest realistic document (90 levels, 60 daily results, a 200-move run, validated by the save schema), 300 per-move writes of `current` after 20 warm-up writes; asserts p95 < 5 ms. It lives in the root `test/` folder because it imports Node built-ins.
- **Time Jest perf tests with `performance` from `node:perf_hooks`,** never the global `performance.now()`: the React Native Jest preset replaces it with a 1 ms `Date.now` mock (the first version of the test reported p50 = 0.00 ms).
- Measured on the Mac: p50 about 0.01–0.12 ms, p95 about 0.02–0.17 ms. The 5 ms budget, with more than 30× headroom, is a stable regression guard: it catches a missing transaction or a quadratic serializer, not device I/O.
- **On the device:** Debug menu -> Performance -> "Run save benchmark" (`save-benchmark.ts`, template, test builds only) writes the same document 300 times into a scratch database `perf-bench.db` (never the real save) through the expo-sqlite driver, times each write with `performance.now()` (high-resolution on device; the file is on the ESLint clock allow-list) and appends `{ kind: 'save-benchmark', data: { p50, p95, max } }` to the perf log.

## Draw-call budget

- Each game's `apps/<game>/src/board/draw-board.test.ts` feeds its busiest frame (a turn's timeline sampled mid-animation) to `drawBoard` through a recording canvas (a `Proxy` that counts every canvas call and keeps every drawn text), then asserts the game's budget: `expect(total).toBeLessThanOrEqual(200)`. It runs in the `unit` Jest project because `draw` receives its Skia objects through the render kit and imports no Skia (Skia's JSI module does not load there).
- A game's budget constant must be ≤ `perf.drawCallsPerFrameMax` (1,000). `check-perf-code.mjs` fails on a `draw-board.ts` without that test, or a budget over the ceiling.

## Bundle size

```sh
cd apps/<game> && npx expo export --platform ios --no-bytecode --output-dir ../../reports/perf/export-ios
node ${CLAUDE_SKILL_DIR}/scripts/check-bundle-size.mjs reports/perf/export-ios --root . --baseline perf-baselines/bundle-ios-<game>.json
```

- First run: add `--write-baseline` and commit the baseline file. An approved growth: rewrite it with a `Gate-Change:` trailer.
- Measured (SDK 57): services spike without FormatJS polyfills 1,136,696 B minified JS / 1,813,398 B Hermes bytecode; with the forced polyfills (en, de, fa, ckb) 1,983,418 B / 2,404,414 B; benchmark probe with Skia, Reanimated, RNGH, audio and FlashList 2,314,613 B / 3,155,700 B. The polyfills cost 0.85 MB of JS and load in 11 ms on the simulator — accepted because Hermes lacks `PluralRules`, `Locale` and numbering systems. Hermes memory-maps bytecode, so size matters mostly through the module initialisation it implies.
- Before adding a runtime dependency, compare `expo export` sizes before and after.

## Memory footprint

After the smoke flow on the simulator: `phys_footprint` must stay ≤ 150 MB (footprint's MB, 1,048,576 bytes). `npm run e2e:ios` measures it in its memory step: it plays the game's smoke flows again, finds the app's process on that simulator (`pgrep -f 'Devices/<udid>/.*/<App>\.app/<App>'`) and runs `footprint --pid <pid> -j <file> -f bytes --noCategories` (no `sudo` for simulator apps); the result is in `reports/e2e/<game>/perf.json`. Costs to keep in mind: one Skia `<Canvas>` (48 × 15 pt at 3×) ≈ 0.18 MB and ≈ 2.8 ms to mount; a rasterized 24 pt icon at 3× is a 0.3–1.4 KB PNG; a pre-rendered texture costs w × h × 4 bytes (1024² = 4 MB); one second of mono float audio at 48 kHz is 192 KB.

## The owner's steps

A human step with a TestFlight **test** build, before each release (tell the owner when the build is ready):

1. Debug menu (S15) -> Performance -> switch on "Record frame times".
2. Play 5 levels normally (a real-time game: at least 60 s).
3. Force-quit and relaunch the app 5 times (for 5 cold starts), and run "Run save benchmark" once.
4. Debug menu -> Performance -> "Share performance report" -> AirDrop it to the Mac or paste it into the chat.

Claude saves it as `reports/perf/<device>-<version>-<build>.json` and runs `check-perf-report.mjs` on it.
