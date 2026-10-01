---
name: performance-budgets
description: Keeps Pocket Arcade inside its performance budgets - cold start, hitch rate, frame p95, save writes, draw calls, bundle size, memory - with the frame recorder and cold-start log. Use when adding animation, Skia, dependencies or startup work, or reading a perf report. Not for a11y (accessibility).
---

# Performance budgets

Every game starts in under a second, animates without hitches, saves in under 5 ms, and stays inside its draw-call, bundle and memory budgets; the measurements come from the owner's phone, the simulator and Jest, and scripts judge them against the budgets in `quality-gates.json`.

## Rules that must hold

1. **Stay inside the budgets:** cold start < 1,000 ms (median of 5, owner's iPhone), hitch rate ≤ 10 ms/s and p95 frame ≤ 17 ms while animating, save write p95 < 5 ms, draw calls per frame ≤ the game's budget ≤ 1,000, minified JS ≤ 6,000,000 bytes and ≤ +10 % over the baseline, footprint ≤ 150 MB. Why: the product promises an instant, smooth, offline toy on the owner's phone.
2. **Keep every budget in `quality-gates.json` (`perf`); loosen one only with a device report, the owner's approval and a `Gate-Change:` trailer.** Why: one checked-in source the owner can review, read by tests and scripts.
3. **Measure only Release builds of the test variant; the owner's device is the truth, the simulator only shows regressions.** Why: dev mode slows JS on purpose, and the simulator runs on the Mac's CPU at 60 fps.
4. **Never put per-frame data in React state;** keep it in shared values and Skia pictures, and re-render only on events. Why: a React render per frame cannot fit an 8.3 ms frame at 120 Hz.
5. **Allocate no Skia object in a per-frame worklet or frame callback;** cache static layers; draw 100+ identical sprites with `<Atlas>`. Why: `Skia.Paint()`/`Skia.Color()` create native objects every frame, and each draw call costs record and GPU time.
6. **Stop every frame callback when its timeline ends, on background, during a full-screen ad and on blur; the frame recorder never owns a callback.** Why: an idle board must not render, and an extra display link changes what it measures.
7. **Give every game a draw-call budget test (`draw-board.test.ts`) at or under the 1,000 ceiling.** Why: counting canvas calls on the busiest frame is the headless stand-in for GPU cost.
8. **Keep at most 8 Skia canvases per screen outside the board, never one per list item, and at most 150 tiles mounted.** Why: each canvas costs about 0.18 MB and 2.8 ms to mount.
9. **Check the bundle delta before adding a runtime dependency; add no Intl locale data beyond en, de, fa, ckb; keep Hermes; generate no code at runtime.** Why: bundle weight is start-up work, and Hermes runs precompiled bytecode.
10. **Keep module scope and the Splash cheap:** only save, settings, language and fonts before Home; ads, consent, the store and textures start after the Home-interactive mark. Why: the cold-start budget.
11. **Time Jest perf tests with `performance` from `node:perf_hooks`.** Why: the React Native Jest preset replaces the global with a 1 ms mock.
12. **Keep performance data on the phone** (test builds' `perf_log`); it leaves only through the share sheet, and the owner's device report is a human step before each release. Why: no analytics and no network requests from our code.

## Workflow

1. **At Shell steps 7 and 8.** Read [references/measuring.md](references/measuring.md), "When the layer is installed, and who wires what". **Step 7** (the JS half, Shell core, with `start-shell.ts` and the composition root that import it): copy `templates/shell-perf/` to `packages/shell/src/app/perf/` (the perf log, the cold-start mark, the frame recorder, the save benchmark with its largest realistic save (`large-save-doc.ts`), the share, and `debug-perf-actions.ts` with its device side `debug-perf-device.ts`, the debug menu's Performance actions) and `templates/root-test/save-write.perf.test.ts` to `test/integration/save/`, and merge `templates/quality-gates.budgets.json` into `quality-gates.json`. **Step 8** (the native half, with the native plugin list `packages/shell/src/config/shell-plugins.ts`, before the first E2E run, which measures cold start): copy `templates/shell-native/` into `packages/shell/` (the Swift module `ProcessStartModule`, the `E07Shell` podspec and `expo-module.config.json`; a native rebuild follows). In a partial Shell `app/perf/` and the shell-native module are Shell core (createDebugParts and Home read them), whatever the slice; only Home's mark waits for S4. The rest is wired by the files' owners, and `check-perf-code.mjs` fails until each is there (rule `perf-layer`: the JS half once `start-shell.ts` exists, the native half once the plugin list exists; rule `debug-perf-wired`): `markJsEntry()` inside `startShell` (`start-shell.ts`), right after `readParityLaunch()` (rtl-and-direction), `createPerfLog` and `createDebugPerfActions` in the shared test-only pair, `TEST_ONLY.createPerfLog(saveDriver)` and `TEST_ONLY.createDebugPerfActions({ perfLog, nowMs })` in `createDebugParts`, exposed on `DebugServices` (e2e-maestro), and `useColdStartMark(useOptionalDebugServices()?.perfLog ?? null)` in `use-home-model.ts` (toybox-screens). Wire `sampleFrame(...)` as the first statement of the board host's frame runners (with the actions' `frames` shared values). Test builds also append `feedback` entries (game-audio-and-haptics' recording ports): the perf log's entry kinds are `frames`, `cold-start`, `save-benchmark` and `feedback`. Check that `withShell` sets `ios.infoPlist.CADisableMinimumFrameDurationOnPhone: true` (without it ProMotion phones run at 60 fps; the code check fails otherwise).
2. **Any change with animation, Skia, frame callbacks, lists or start-up work.** Read [references/performance-rules.md](references/performance-rules.md) and run `check-perf-code.mjs` (step 6). Give hot components a `<Profiler>` re-render test.
3. **A new game.** Add its `draw-board.test.ts` with the busiest frame and a budget number (Line Siege: 200); stop its frame callbacks with the board lifecycle.
4. **Adding a runtime dependency.** Export before and after (`npx expo export --platform ios --no-bytecode`) and run `node ${CLAUDE_SKILL_DIR}/scripts/check-bundle-size.mjs <export-dir> --root . --baseline <baseline.json>`; explain any growth to the owner before keeping it.
5. **Changing a budget.** Read [references/budgets-and-gates.md](references/budgets-and-gates.md); stop and ask the owner before loosening. Run `node ${CLAUDE_SKILL_DIR}/scripts/check-budgets.mjs .`.
6. **Run the code check** from the repo root and fix every `FAIL` line (each names the file, the rule and the fix) until it prints `RESULT: PASS`: `node ${CLAUDE_SKILL_DIR}/scripts/check-perf-code.mjs .`; then `npx jest packages/shell/src/app/perf test/integration/save apps/<game>/src/board/draw-board.test.ts --ci --selectProjects unit --coverage --collectCoverageFrom='packages/shell/src/app/perf/**/*.ts' --coverageThreshold='{}'` (paths first; only `npm run test:coverage` judges the thresholds).
7. **Simulator regression run** (Release, test variant): `npm run e2e:ios -- --app <game>` (the e2e-maestro runner) does 6 cold launches against the committed `perf-baselines/cold-start-sim-<game>.json` (first launch dropped, × 1.2; the first run writes the baseline) and `footprint` after the smoke flow (≤ 150 MB), into `reports/e2e/<game>/perf.json`; then `check-perf-report.mjs reports/perf/sim-perf-log.json --root . --sim-baseline <medianMs>`. The measuring reference has the exact commands.
8. **Before a release (human step).** Ask the owner for a device report (the steps are in the measuring reference), save it under `reports/perf/`, and run `node ${CLAUDE_SKILL_DIR}/scripts/check-perf-report.mjs <report.json> --root .`; follow [examples/reading-a-perf-report.md](examples/reading-a-perf-report.md) to read it and report the numbers.

## Definition of done

- [ ] No React state, Skia allocation or unstoppable frame callback per frame; the recorder only samples the board host's callback.
- [ ] Every game has a draw-call budget test at or under 1,000, and screens keep ≤ 8 canvases outside the board and ≤ 150 tiles.
- [ ] The perf template tests and the save-write perf test pass (`npx jest packages/shell/src/app/perf test/integration/save --ci --selectProjects unit`); `process-start.ts` and `share-perf-report.ts` carry their `// device-only:` line.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-budgets.mjs .` prints `RESULT: PASS`, and any new dependency passed `check-bundle-size.mjs`.
- [ ] Before a release: the owner's device report passes `check-perf-report.mjs`, and the numbers are in the report to the owner.
- [ ] The perf layer is in: its JS half from Shell step 7 (`app/perf/`, `markJsEntry()`, the perf log and the debug perf actions in `createDebugParts`, Home's `useColdStartMark`) and its native half from step 8 (the shell-native module) (`perf-layer`, `debug-perf-wired`).
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-perf-code.mjs .` prints `RESULT: PASS`.

## Anti-patterns

- **`setScore(x)` inside `useFrameCallback`.** One React render per frame; batch once per frame with `scheduleOnRN` into the session store.
- **`Skia.Paint()` in `draw()`.** Build paints and paths once in the render kit and reuse them.
- **A `<Canvas>` per level tile or per icon.** Use the rasterized `Icon`, or one canvas for the whole group.
- **Leaving the board's frame callback running on an idle board or behind an ad.** Stop it with `setActive(false)`.
- **Measuring in a dev build or on the simulator and calling it the budget.** Only the owner's Release test build is the truth.
- **Timing a Jest test with the global `performance.now()`.** It is a 1 ms mock there; import it from `node:perf_hooks`.
- **Raising a budget to make a check pass.** Fix the work; loosening needs the owner and a `Gate-Change:` trailer.
- **Starting ads, consent or the store connection in the Splash "to be ready".** They belong after Home is interactive.
- **Adding locale data or a library "just in case".** Every kilobyte is start-up work; measure the delta first.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/budgets-and-gates.md](references/budgets-and-gates.md) | The budget table, where each is measured, `quality-gates.json`, how a budget may change | Workflow step 5, and when a budget is in question |
| [references/measuring.md](references/measuring.md) | Frame recorder, perf log and share, cold-start native module and marks, save-write test and benchmark, draw-call test, bundle and memory commands, the owner's steps | Workflow steps 1, 7 and 8 |
| [references/performance-rules.md](references/performance-rules.md) | Per-frame work, re-renders, Skia cost, callbacks and textures, lists, bundle, Hermes and start-up | Workflow step 2 |
| [examples/reading-a-perf-report.md](examples/reading-a-perf-report.md) | A real-shaped device report, the check's output and how to read it | Workflow step 8 |
| `templates/shell-perf/` | Frame histogram and report, recorder hook, perf log (kinds `frames`, `cold-start`, `save-benchmark`, `feedback`), share, process start, cold-start marks, save benchmark, the debug menu's Performance actions (`debug-perf-actions.ts`, test builds), and their tests | Workflow step 1 (Shell step 7); copy to `packages/shell/src/app/perf/` |
| `templates/shell-native/` | `expo-module.config.json`, `ios/E07Shell.podspec`, `ios/ProcessStartModule.swift` (process start time) | Workflow step 1; copy into `packages/shell/` |
| `templates/root-test/save-write.perf.test.ts` | Jest guard: save-write p95 < 5 ms on `node:sqlite` | Workflow step 1; copy to `test/integration/save/` |
| `templates/quality-gates.budgets.json` | The `perf` and `a11y` sections of `quality-gates.json` | Workflow steps 1 and 5 |
| `scripts/check-perf-code.mjs` | Checks 14 code rules: Skia and React state per frame, callbacks that stop, the recorder, draw-call budgets, canvases, codegen, Hermes, locale data, Jest clocks, the ProMotion plist key, the cold-start layer (`perf-layer`: JS half due with `start-shell.ts`, Shell step 7; native half due with the plugin list, step 8) and the debug menu's Performance actions (`debug-perf-wired`) | Workflow steps 1 and 6, after every relevant change |
| `scripts/check-budgets.mjs` | Checks `quality-gates.json` `perf`: present, positive, not looser | Workflow step 5 |
| `scripts/check-perf-report.mjs` | Judges a device report (latest 5 cold starts, frames, hitch rate, save benchmark) or a simulator perf log (`--sim-baseline`) | Workflow steps 7 and 8 |
| `scripts/check-bundle-size.mjs` | Checks an `expo export --no-bytecode` against the cap and the baseline | Workflow step 4 and before a release |
| `scripts/lib/budgets.mjs` | The budget table with defaults and the loader | Read only when changing a budget rule |
| `scripts/lib/source-scan.mjs` | JSX, call and import scanning helpers | Read only when changing a checker |
| `scripts/selftest.mjs` | Proves all four checkers pass their good fixtures and catch each planted bug | After changing a script or fixture |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/shared.json` | Declares the shared files this skill copies in | When adding a shared file |
| `tests/fixtures/` | Good and planted-bad inputs, one folder per checker (plus `check-perf-report-sim/` for the simulator mode) | When adding a rule |

## Related skills

- `board-rendering-skia` - the board host, frame runners, pictures and the draw-call test.
- `realtime-game-loop` - fixed-step loops that must stop when idle.
- `react-components-and-hooks` - Profiler re-render tests and list decisions.
- `dependency-management` - adding packages (with the bundle delta from here).
- `ios-simulator-build` - Release builds of the test variant for measuring.
- `accessibility` - the `a11y` budgets in the same gates file.
