---
name: board-rendering-skia
description: Builds Skia game boards - Picture renderer, pure draw(), timeline, frame clock (startAt fix), BoardLayout, palettes, board text/RTL, particles, 120 Hz, pixel goldens. Use when building, drawing or animating a game board. Not for touch input (board-gestures-and-input) or sims (realtime-game-loop).
---

# Board rendering with Skia

Every Pocket Arcade board is one Skia `<Canvas>` whose single `<Picture>` is recorded on the UI thread from the game's pure `draw()`, animated by a timeline that a self-stopping frame clock plays, and proven by unit tests, a draw-call budget and pixel goldens. This skill builds the Shell's board host once and each game's board after it, and its scripts prove the result.

## Rules that must hold

1. **One `<Canvas>` per board with one `<Picture>` recorded in `useDerivedValue` from the game's `draw()`.** Why: dynamic boards are Skia's immediate-mode case; one picture per frame keeps cost predictable. Atlas only for hundreds of identical sprites, retained nodes only for static art.
2. **`draw(canvas, frame)` is a pure worklet in a `'worklet'` file:** it reads only `frame` (`view`, `fx`, `highlight`, `colors`, `layout`, `kit`), imports Skia types only, allocates no Skia objects, reads no clock or random source. Why: the same function then renders on device, in Jest goldens and in Node with identical pixels.
3. **Push ONE `scene` shared value per committed move** (`makeScene(seq, view, tracks)`, `startAt: NOT_STARTED`); the frame callback stamps `startAt = info.timestamp` on its first frame. Never use `timeSinceFirstFrame`. Why: Reanimated resets it to 0 on every re-activation, which froze every animation after the first (verified).
4. **The frame callback runs only while something moves** and its body is one call into `runBoardFrame`, which holds the `try/catch`. Why: an idle board must cost nothing, an uncaught UI-thread error kills the app, and React Compiler bails out of hooks with value blocks inside `try/catch`.
5. **Save before animating; a new move fast-forwards.** The session applies and saves, then `presentMove` cancels old cues, pushes the final view and schedules new cues. Why: killing the app mid-animation must lose nothing; the view is always the final state.
6. **`buildTimeline(events, motion)` is pure and honours `'reduced'`:** half durations, no particles or shake, no overshoot. Why: reduce motion is a spec requirement and is testable as data.
7. **An effect layer that is not a tween of something visible (flash, wave, glow, burst, shake) draws only while its track plays (`ageMs > 0`, the `isPlaying` helper).** Why: a sample holds a track's `from` values before it starts, so an unguarded effect shows at full strength at moment 0.
8. **Selection and hints are UI state the host passes as `highlight` (`BoardHighlight`, `EMPTY_HIGHLIGHT`), and the drag ghost sits exactly on the hovered cell.** The gesture layer applies the board's `dragLiftPt` once; draw adds no offset. Why: game state, bots and undo never see a selection, and the ghost cell must be the placed cell.
9. **`BoardLayout` is a pure worklet of the actual canvas size and is shared by draw and hit-testing.** Why: iPad, landscape and resizable windows need no special case, and draw and touch cannot drift.
10. **Boards never pixel-flip.** A game that opts in (`isMirroredInRtl`) mirrors positions in `BoardLayout`. Why: `scaleX(-1)` mirrors letters and digits.
11. **Digits are localised in `toView()` and drawn with `drawText` (`drawFittedText` in a small shape); Arabic-script words use a cached Skia `Paragraph`; widths come from glyph widths.** Why: `drawText` does no shaping, and `measureText` is unimplemented in CanvasKit (Jest, Node).
12. **Paths are built once with `Skia.PathBuilder` at unit size** and placed with `canvas.translate/scale`. Why: the mutable `SkPath` API is deprecated in Skia 2.6 and allocates.
13. **Stop everything when the board may not run, and switch the clock only through `board-clock-state`.** `useGameLifecycle` (app active AND screen focused AND no full-screen ad) stops the clock, cancels cues and suspends audio; a scene pushed while the board may not run is held until it may; every resume records at least one frame; a done message names its run, and JS never reads the scene shared value back. Why: background, ads and blur must not keep a display link or sounds alive, and a stale done read through `scene.get()` froze the board after every rewarded continue (cause class A, traced on the simulator 2026-10-01).
14. **`ios.infoPlist.CADisableMinimumFrameDurationOnPhone = true` in `withShell`.** Why: without it iOS caps third-party apps at 60 fps on ProMotion phones.
15. **The canvas is one accessible image:** `accessibilityRole="image"`, `accessibilityLabel` = `t()` of `board.describe(view)`. Why: Skia content is invisible to VoiceOver and labels must be translated.
16. **Every board is proven three ways:** pure unit tests (timeline, clock, layout), a draw-call budget test that also asserts every localised label, and pixel goldens at 3 sizes × moments 0, 0.5, 1 with 0.1 % tolerance. Why: a two-digit label is below the golden tolerance, so pixels alone miss it; goldens catch what assertions forget.
17. **Draw-call budget per game on the busiest frame, never above 1,000.** Why: counting canvas calls is the headless stand-in for GPU cost; a higher number needs an on-device frame report.

## Workflow

1. **Classify the board.** Read [references/architecture.md](references/architecture.md): turn-based (this skill end to end), simulate-then-replay (the volley comes from `realtime-game-loop`; the board, timeline and goldens are this skill's) or real-time (the loop, the arena draw test and its goldens come from `realtime-game-loop`; palettes and the drawing rules still come from here). A playable board also needs the input side: load `board-gestures-and-input` in the same session.
2. **Check the host.** Read "Prerequisites in the app repo" in [references/architecture.md](references/architecture.md): the host has a pure/golden stage (game-kit, the audio and haptics ports and fakes, the gesture kit, RNTL 14.0.1 with test-renderer 1.2.0) and a Shell stage (S5: `AppText`, `renderWithShell`), each prerequisite with its owner skill. From the repo root run `node ${CLAUDE_SKILL_DIR}/scripts/check-board-files.mjs .`; on a repo with no host or board folder yet it lists every file to copy. For every `host-file-missing` copy the file from `templates/` (mapping: `templates/game-kit/X` → `packages/game-kit/src/X`, `templates/shell/game-host/X` → `packages/shell/src/game-host/X`, `templates/shell/app/X` → `packages/shell/src/app/X`, `templates/tooling/quality/X` → `packages/tooling/src/quality/X`, `templates/test/goldens/boards/skia-golden.ts` → same path). These files are copied verbatim (no placeholders). pocket-arcade-index copies the host at Shell step 7 (`packages/shell/src/game-host/**` with `board-clock-state.ts` and its two tests, `packages/game-kit/src/timeline/**`, `packages/tooling/src/quality/**`, `test/goldens/boards/**`) and Line Siege's `build-timeline*`, `board-ids*` and `monster-tracks.ts` at Shell step 3; no host file is needed before its step. A `host-import-unresolved` line names the prerequisite and its owner skill: build it first. In a game-first repo (`shell-slice.json` without `S5`, or `"screens": []`) the Shell-stage files print `SKIP` (a pass) until the Shell step. Fix `jest-golden-project` and `plist-120hz` as the messages say.
3. **Read before writing the game's board:** [references/timeline-and-clock.md](references/timeline-and-clock.md) for `buildTimeline` and the clock, [references/drawing.md](references/drawing.md) for `draw()`, kit, palettes, layout, text and Toybox framing, [references/api-traps.md](references/api-traps.md) for worklet rules and API traps. Imitate [examples/line-siege/](examples/line-siege/) (the verified pilot board, with its reviewed goldens).
4. **Copy the game templates** from `templates/game/board/` to `apps/<game-id>/src/board/` and `templates/test/goldens/boards/__GAME_ID__-board.golden.test.ts` to `test/goldens/boards/<game-id>-board.golden.test.ts`. Replace `__GAME_ID__` (kebab, `line-siege`), `__GAME_PASCAL__` (`LineSiege`) and `__GAME_CAMEL__` (`lineSiege`) in file names and contents. The templates draw the Tap Flip template game, so they compile as is against `game-rules-engine`'s rules templates (and `board-gestures-and-input`'s input template); then adapt the view, events, layers, `board-palettes.json` and `board-contrast.json` to the game ("The rules shape the templates assume" in `drawing.md`), imitating Line Siege.
5. **Build test-first, in this order:** palettes and `board-contrast.json` → `to-view.ts` → `build-timeline.ts` with its test (budget, reduced motion, cues) → `layout-board.ts` with its any-size test (and room below the last row for a `dragLiftPt`) → `draw-board.ts` with the draw-call budget, moment-0, highlight and label tests → `<game-id>-board.ts` (`isMirroredInRtl`, `describe` key in the game's four catalogs, `dragLiftPt` and `targetsOfMove` when the game drags or hints). Run `npx jest apps/<game-id>/src/board --ci --selectProjects unit --coverage --collectCoverageFrom='apps/<game-id>/src/board/**/*.ts' --coverageThreshold='{}'` after each step (paths first: `--selectProjects` would swallow them as project names; only `npm run test:coverage` judges the thresholds).
6. **Lint, format and type-check the new files:** `npx eslint --fix apps/<game-id>/src/board test/goldens/boards` and `npx prettier --write` on them (import order and line wrapping depend on the game id), then `npx tsc -p apps/<game-id> --noEmit` and `npx tsc -p tsconfig.json --noEmit`.
7. **Create the pixel goldens deliberately** ([references/testing-and-goldens.md](references/testing-and-goldens.md)): `npx jest test/goldens/boards/<game-id>-board.golden.test.ts --selectProjects golden -u`, open all 9 PNGs with the Read tool and compare them with the intended look (moment 0 shows no effect that starts later; 0.5 mid-flight; 1 the final view), then `CI=1 npx jest --ci --selectProjects golden`. Commit baselines with a `Gate-Change:` trailer.
8. **Run the checks:** `node ${CLAUDE_SKILL_DIR}/scripts/check-board-code.mjs .` and `node ${CLAUDE_SKILL_DIR}/scripts/check-board-files.mjs . --game <game-id>`. Fix every `FAIL` line (each names the file, the rule and the fix) and rerun until both print `RESULT: PASS`.
9. **Look at it for real.** Build the app in Release for the iOS simulator, play a move in each of the four languages, and screenshot the board. The S5 screen's Shell parts (top bar, margins 4/14/40 around the board) are compared with the Toybox design screenshot by `toybox-visual-parity`, with the board area masked because the mockup only draws a placeholder there; the board's own pixels are proven by the goldens. The simulator caps at 60 fps; the owner confirms 120 Hz and the hitch rate on a ProMotion phone with the debug frame-time recorder.

## Definition of done

- [ ] The host files exist in `packages/shell/src/game-host`, `packages/game-kit/src/{timeline,geom}`, `packages/tooling/src/quality` (worklet boundary) and `test/goldens/boards/skia-golden.ts`, and `board-scene.test.ts`, `check-worklet-boundary.test.ts` and `worklet-transform.test.ts` pass.
- [ ] The game's board folder has palettes (4 sets, identical keys) with `board-contrast.json`, `to-view.ts`, `build-timeline.ts`, `layout-board.ts`, `draw-board.ts`, `<game-id>-board.ts`, and their tests pass in `npx jest apps/<game-id>/src/board --ci --selectProjects unit --coverage --collectCoverageFrom='apps/<game-id>/src/board/**/*.ts' --coverageThreshold='{}'`.
- [ ] Moment 0 draws no effect that starts later (a draw test and the moment-0 goldens), the host `highlight` is drawn, and a board with a drag lift draws its ghost on the placed cell.
- [ ] The busiest frame stays within the game's draw-call budget (≤ 1,000) and every localised label is asserted through the recording canvas.
- [ ] 9 golden PNGs (3 sizes × 0, 0.5, 1) exist, were looked at, and `CI=1 npx jest --ci --selectProjects golden` passes.
- [ ] `npx tsc --noEmit` (app and root programs) and `npx eslint --max-warnings 0` pass on the new files; no `__GAME_…__` placeholder is left.
- [ ] Reduced motion removes particles, shake and overshoot; the canvas has a translated `accessibilityLabel`; the board runs only while app active, focused and no ad.
- [ ] `npx jest packages/shell/src/game-host/board-clock --ci --selectProjects unit` passes: `board-clock-state.test.ts` (push while paused, resume after done, stale done) and `board-clock-traces.test.ts` (the two device traces: the round-4 hook freezes the rewarded continue, `board-clock-state` does not).
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-board-code.mjs .` prints `RESULT: PASS`.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-board-files.mjs . --game <game-id>` prints `RESULT: PASS`

## Anti-patterns

- **Animating with `timeSinceFirstFrame` or a `t0` stored on JS.** The second move freezes. Stamp `startAt` from `info.timestamp` in the frame runner.
- **Creating `Skia.Paint()`, `Skia.Color()` or paths inside `draw()` or at module import.** Native allocations every frame, and module scope breaks tests. Build once in the kit (`makeBoardKit`, `buildPaths`); one recorder per canvas via `useState`.
- **Putting per-frame data in React state or re-rendering the HUD per frame.** A 120 Hz frame is 8.3 ms. Positions live in shared values and the picture; React renders on events.
- **Storing only "the change" in the view and reading old state in `draw()`.** The view is the final state; anything that vanishes carries its own position in a track.
- **A frame callback that keeps running on an idle board, in the background or under an ad.** Stop on `onDone(run, seq)` through `finishRun` and through `useGameLifecycle`.
- **Guarding `onDone` with `scene.get().seq` on the JS thread.** Until the UI applies a push, the JS read returns the old scene, so the done of the scene before a continue stops the continue on its first frame (the frozen board after a rewarded ad). Compare runs in `board-clock-state`.
- **Starting the clock for a scene pushed while an ad or another screen covers the board.** Its animation plays where nobody sees it; `pushScene` holds it until the board may run.
- **Reading `useReducedMotion()` in the board.** Reanimated reads it once at app start, so a later change is missed; the Shell's Reduce motion setting arrives as `motion`.
- **Flipping the board with `scaleX: -1` for RTL.** Mirror positions in `BoardLayout` instead.
- **`isRtl && TextDirection.RTL`.** RTL is 0; choose explicitly.
- **Raising the golden tolerance or re-running `-u` without opening the PNGs.** Fix the code or accept a deliberate change with a `Gate-Change:` trailer.
- **Calling a plain JS helper from `draw()` or `layout()`.** It throws on the UI thread at runtime only; move the helper into a `'worklet'` module (the template's `board-ids.ts`).
- **Asserting small text through pixels.** Use the recording canvas; 0.1 % tolerance cannot see a missing number.
- **Drawing a flash or wave whenever its entry exists.** It shows at full strength at moment 0; guard it with `isPlaying` (`ageMs > 0`).
- **Offsetting the ghost in `draw()` (`row - 1`).** The block lands elsewhere and an edge row becomes unreachable; set `dragLiftPt` on the board and let the gesture layer lift the pointer.
- **Keeping a selection or hint in game state.** Bots, par and undo would see it; the host passes it as `highlight`.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/architecture.md](references/architecture.md) | Why no engine, data flow, file map with owners, GameBoard contract, board kinds, prerequisites | Workflow step 1, before any board work |
| [references/timeline-and-clock.md](references/timeline-and-clock.md) | Tracks, sampling, `buildTimeline`, the startAt clock fix, `board-clock-state`, the rewarded-continue freeze (cause, both device traces, fix), presenter, cues, lifecycle, the board-clock trace and `game.board-frame`, 120 Hz | Step 3, before writing a timeline or touching the clock |
| [references/drawing.md](references/drawing.md) | `draw()` rules, kit, palettes, paths, layout, RTL, text and fonts, particles, Atlas, performance, Toybox framing, a11y | Step 3, before writing draw, layout, view or palettes |
| [references/testing-and-goldens.md](references/testing-and-goldens.md) | Test levels, draw-call budget, pixel goldens set-up and acceptance, failures, headless previews | Step 7, and whenever a golden fails |
| [references/api-traps.md](references/api-traps.md) | Worklet rules and the SDK 57 API churn table, re-verify list | Step 3, and when something works in Jest but not on device |
| `templates/game-kit/` | `timeline/track.ts`, `sample.ts` (+ test), `particles.ts` (+ test), `geom/board-layout.ts` (+ property test) | Step 2 (copy verbatim to `packages/game-kit/src/`) |
| `templates/shell/game-host/` | Board host: types (`BoardHighlight`, `EMPTY_HIGHLIGHT`, `GameBoard` with `dragLiftPt` and `targetsOfMove`), kit (+ test), scene clock (+ test), the clock's decisions `board-clock-state.ts` (+ test, + `board-clock-traces.test.ts` replaying the two device traces), frame runner with the test-build trace sampling (+ test), clock hook and PNG painter (both with a `device-only` line naming the simulator check or the goldens that cover them), recorder (+ test), text with `drawFittedText` (+ test), error text (+ test), canvas (+ test), presenter (+ test), cue scheduler (+ test), host with its `highlight` prop (+ test), lifecycle (+ test), the test-build layout probe for Maestro and parity board masks, clipped to the board frame, with the `game.board-frame` `{seq, settled}` probe (+ test) | Step 2 (copy verbatim to `packages/shell/src/game-host/`) |
| `templates/shell/app/` | `use-is-app-active.ts` (foreground check) and its test, synced from the library (the one shared copy, also shipped by `game-audio-and-haptics`) | Step 2 |
| `templates/tooling/quality/` | `check-worklet-boundary.ts` (+ test) and `worklet-transform.test.ts`: the `npm test` gate for `'worklet'` modules | Step 2 (copy verbatim to `packages/tooling/src/quality/`) |
| `templates/game/board/` | The Tap Flip template board with `__GAME_ID__` placeholders: palettes and `board-contrast.json`, ids, view, timeline (`cells-flipped`), layout, draw (edged lit cells, glow, burst, bonus label, hinted rings), board object and their tests | Step 4 |
| `templates/test/goldens/boards/` | `skia-golden.ts` matcher and the `__GAME_ID__-board.golden.test.ts` pixel golden | Steps 2 and 4 |
| [examples/line-siege/](examples/line-siege/) | Line Siege v1's board, synced from the library's canonical copy (`board/`: lanes band, wall and hearts, board, tray, three monster kinds with shape cues, beam, shock and burst tracks, breaches, `drawFittedText` health, the selected-slot ring and hinted move, the drag lift, palettes and `board-contrast.json`, with tests; `rules/` types, tuning and pieces), its golden test and its 9 reviewed golden PNGs | Step 3, as the model to imitate |
| `scripts/check-board-code.mjs` | Checks worklets, frame clock (`clock-runnable`: push, stop, resume and done through `board-clock-state`), worklets API, pure draw, Skia API, canvas, a11y, lifecycle, reduced-motion source | Step 8 and at the end |
| `scripts/check-board-files.mjs` | Checks host files, the layout probe staying inside the board frame, board files, palettes, timeline and draw tests, goldens and baselines, 120 Hz, Jest golden project | Steps 2 and 8 and at the end |
| `scripts/selftest.mjs` | Proves both checkers pass good fixtures and catch each planted bug | After changing a checker |
| `scripts/lib/` | `source-scan.mjs`, the TypeScript source helpers the checkers share | When changing a checker |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/shared.json` | Declares the shared files this skill copies in | When adding a shared file |
| `tests/build-fixtures.mjs` | Rebuilds the good fixtures from the templates (the composed Tap Flip set) and every `check-board-files` bad case; `--check` proves the good fixtures still equal the templates (the self-test runs it first) | After changing a template or a checker, before the self-test |
| `tests/fixture-base/` | What the templates do not ship: stand-ins for files other skills own (`AppText`, `renderWithShell`, the ports, the gesture kit, the Tap Flip rules types), `package.json`, the Expo config, a real-time board, and the 9 reviewed Tap Flip golden baselines | When changing the fixture builder |
| `tests/fixtures/` | Good and planted-bad inputs for both checkers (built by `tests/build-fixtures.mjs`, except `check-board-code`'s small bad trees) | When adding a rule to a checker |

## Related skills

- `board-gestures-and-input` - touch on the board: `useBoardGestures`, hit-testing, swipes, intents to moves (load with this skill for any playable board).
- `realtime-game-loop` - fixed-step loops, simulate-then-replay and the geometry kit for Bank Shot and Halo Drift.
- `game-rules-engine` - the GameModule contract, events and the seeded PRNG the board draws from.
- `game-host-integration` - the Game screen around the board: HUD, pause, results, save points.
- `game-audio-and-haptics` - the sound and haptic ports that timeline cues call.
- `code-drawn-art-and-icons` - sprite pre-rendering, app icon and store art from the same draw code.
- `golden-tests` - the golden policy, `jest -u` rules and the `Gate-Change:` trailer.
- `toybox-visual-parity` - comparing the Game screen's Shell parts with the Toybox design screenshot.
- `performance-budgets` - the frame-time recorder and on-device budgets.
- `accessibility` - palette contrast, colour-blind checks and VoiceOver summaries.
