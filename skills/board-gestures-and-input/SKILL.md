---
name: board-gestures-and-input
description: Wires touch on game boards - useBoardGestures, hitTest with slop, classifySwipe, pan modes, one InputIntent per gesture, pure intentToMove, stick commands, 44 pt targets, RNGH 2/3. Use when adding taps, swipes, drags or aim. Not for drawing (board-rendering-skia) or sim loops (realtime-game-loop).
---

# Board gestures and input

Every touch on a Pocket Arcade board goes through one Shell hook, `useBoardGestures`, which hit-tests against the same `BoardLayout` the renderer draws with and emits at most one `InputIntent` per gesture; the game's pure `intentToMove(state, intent)` alone decides whether it becomes a move. This skill builds that input kit once, each game's `intentToMove`, and the checks that prove both.

## Rules that must hold

1. **Only `packages/shell/src/game-host/use-board-gestures.ts` builds board gestures** (`Gesture.*` builders today, v3 hooks later); the Shell's `ui/` controls outside the board (the Settings volume `Slider`) keep their own. Why: the Gesture Handler v3 migration then rewrites one file, and no second gesture can double-move a board.
2. **One gesture yields at most one `InputIntent`,** emitted in `onEnd` (or `onStart` for long press), never in `onUpdate`. Why: a drag that emitted per update would apply many moves.
3. **Hit-testing uses the board's shared layout with slop:** `hitTest(layout.get(), point, HIT_SLOP)` on the same `BoardLayout` shared value the picture draws with. Why: draw and touch cannot drift at any canvas size, and edge taps still land.
4. **Legality lives only in the game's pure `intentToMove(state, intent)`** in `apps/<game-id>/src/rules/`, and it is "`listMoves(state)` lists this move", nothing else; gestures report what the finger did. Why: bots, tests and replays share one definition of legal, a finished run (empty `listMoves`) gives `null`, and the engine contract test passes.
5. **`intentToMove` handles every intent kind explicitly** (`tap`, `long-press`, `swipe`, `drag-end`, `aim`), returning `null` for the ones the game ignores. Why: an exhaustive switch turns a new intent kind into a compile error instead of a silent no-op.
6. **A tap-then-tap selection is UI state held by the board host, never game state or a move.** The engine lists its `selectRegions`, the gesture layer always sends `tap.selected: null`, the host fills it in, and `intentToMove` returns `null` for a tap inside a select region. Why: bots, sims, the witness solver, par, undo and the move counters must never see a selection.
7. **The drag lift is applied once, in the gesture layer** (`dragLiftPt` from the board, default 0) to the hover, the drawn ghost and the drop target; `intentToMove` and `draw()` never add their own, and a board with a lift keeps that much canvas below its last row. Why: the ghost cell is then always the placed cell, and no edge row becomes unreachable.
8. **Touches are physical.** Gesture code never reads RTL; a board that opts in to mirroring mirrors positions inside `BoardLayout`. Why: `event.x/y` do not mirror under RTL (verified), and swipe directions are physical.
9. **Per-frame finger state stays on the UI thread:** the `pointer` shared value feeds the picture; only hover changes go to JS. Why: a React render per finger move cannot fit a 120 Hz frame.
10. **Continuous input becomes an integer stick command** (0 idle, 1…16 directions by largest dot product, written only on change, 0 on lift). Why: a real-time sim replays bit-exactly only from integer `(tick, command)` logs.
11. **Floats never enter game state:** an aim vector is normalised with `Math.sqrt` and quantised to integers in `intentToMove`. Why: saves stay compact and replays exact on every device.
12. **Board hit regions are at least 44 × 44 pt** on a 402 × 874 pt phone, proven by a test per game. Why: the spec's touch-target minimum; an exception needs the owner's sign-off.
13. **No `Pressable` or Shell button inside the board's `GestureDetector`,** and the app root is wrapped in `GestureHandlerRootView`. Why: React Native's touch system and Gesture Handler must not compete, and without the root view no gesture fires on device.
14. **Everything a gesture callback calls is a `'worklet'` module:** `classify-swipe.ts`, `stick-command.ts`, `pan-intent.ts` and `board-layout.ts` start with `'worklet';` and import values only from other `'worklet'` modules; callbacks reach JS only with `scheduleOnRN(fn, ...args)` (never the deprecated `runOnJS`) and shared values only with `.get()`/`.set()` (never `.value`). Why: gesture callbacks run on the UI thread, where a plain JS function throws at runtime and Jest never notices; React Compiler needs the accessors.
15. **Gesture Handler follows the Expo pin:** ~2.32.0 builder API on SDK 57; the v3 hook API only after the SDK upgrade, migrated as a whole file. Why: hook and builder gestures cannot be related to each other.

## Workflow

1. **Read [references/input-pipeline.md](references/input-pipeline.md)** and pick the game's `panMode` (`none`, `swipe`, `drag`, `aim`) from its table; a real-time game uses the stick instead ([references/stick-input.md](references/stick-input.md)). The input side needs `BoardLayout` and `PointerSample` from the rendering side: when `packages/game-kit/src/geom/board-layout.ts` or `packages/shell/src/game-host/board-types.ts` is missing, build them with `board-rendering-skia` first. `PanMode` itself is declared once in the game-kit contract (`packages/game-kit/src/contract/game-engine.ts`, game-rules-engine); `pan-intent.ts` re-exports it.
2. **Check the kit.** Run `node ${CLAUDE_SKILL_DIR}/scripts/check-board-input.mjs .` from the repo root (add `--game <game-id>` to limit the game side to one game). For every `input-file-missing` copy the file verbatim: `templates/game-kit/X` → `packages/game-kit/src/X`, `templates/shell/game-host/X` → `packages/shell/src/game-host/X` (tests and probes included; `contract/input-intent.ts` is the shared contract file `game-rules-engine` also ships, byte for byte). Wrap the app root in `GestureHandlerRootView` if `gesture-root` fails. In a game-first repo with no Shell app yet, `shell-slice.json` says `"screens": []` and `gesture-root` prints `SKIP` (a pass) until the Shell's app root exists.
3. **Write the game's `intentToMove` test-first.** Read [references/intent-to-move.md](references/intent-to-move.md), copy `templates/game/rules/intent-to-move.test.ts` and `intent-to-move.ts` to `apps/<game-id>/src/rules/`, and replace `__GAME_ID__` (kebab) and `__GAME_PASCAL__` (PascalCase). The template is the Tap Flip template game (tap → `flip`, `null` unless `listMoves` lists it), so it compiles as is against `game-rules-engine`'s rules templates (`<Pascal>State`, `<Pascal>Move`, `create`, `listMoves`). Then replace `candidate()` with the game's own mapping: tap-then-tap and drag with a lift in `examples/line-siege/`, swipe in `examples/flock-tilt/`, aim in `examples/bank-shot/`. Keep the won-state, lost-state and `listMoves` property tests.
4. **Prove touch targets.** Copy `templates/game/board/hit-targets.test.ts` to `apps/<game-id>/src/board/` (it calls the game's `layout-board.ts` and uses its view type from `to-view.ts`, both from `board-rendering-skia`), set `LARGEST_VIEW` to the game's biggest grid, and run it. If a region is below 44 pt, change the layout (fewer columns, a tray beside the board), not the test. A board with a `dragLiftPt` also copies the two lift proofs from `examples/line-siege/board/`: `drag-lift.test.ts` (the ghost cell is the placed cell) and the edge-row cases of `hit-targets.test.ts` (every edge row reachable in portrait and wide layouts).
5. **Wire the Game screen** (the board host factory of `game-host-integration`): `BoardCanvas` calls `useBoardGestures(layout, { panMode, dragLiftPt, onIntent, onHover })` with `dragLiftPt` = `board.dragLiftPt ?? 0`; the host passes `panMode` (`game.engine.panMode`), `onIntent`, `onHover` and `highlight` to `GameBoardHost`. `onIntent` toggles the host's selection for a tap inside `game.engine.selectRegions`, otherwise calls `game.intentToMove(state, { ...intent, selected })` and dispatches a non-null move (which clears the selection); the selection and the hinted move reach the canvas as the `highlight` prop. Real-time boards pass `makeGesture={makeStickGesture}` to the real-time host.
6. **Run the tests:** `npx jest packages/shell/src/game-host packages/game-kit/src/geom apps/<game-id>/src/rules apps/<game-id>/src/board --ci --selectProjects unit --coverage --collectCoverageFrom='apps/<game-id>/src/rules/**/*.ts' --coverageThreshold='{}'` (paths first: `--selectProjects` takes several values and would swallow them; only `npm run test:coverage` judges the thresholds). Gesture tests follow [references/testing-gestures.md](references/testing-gestures.md) (`fireGestureHandler`, `act()`, the mock traps).
7. **Lint, format and type-check:** `npx eslint --fix` and `npx prettier --write` on the new files (import order and wrapping depend on the game id), then `npx tsc -p apps/<game-id> --noEmit`.
8. **Run the check** `node ${CLAUDE_SKILL_DIR}/scripts/check-board-input.mjs .` (or `node ${CLAUDE_SKILL_DIR}/scripts/check-board-input.mjs . --game <game-id>`), fix every `FAIL` line (each names the file, the rule and the fix) and rerun until it prints `RESULT: PASS`. `SKIP` lines count as a pass.
9. **Touch it for real.** On a Release simulator build, tap, drag and swipe the board, including cells on the outer edge, check the ghost and hover preview follow the finger and the block lands on the ghost's cell, and try tap-then-tap. When upgrading Expo, follow [references/rngh-v3-migration.md](references/rngh-v3-migration.md).

## Definition of done

- [ ] The input kit exists (`input-intent.ts`, `classify-swipe.ts`, `stick-command.ts`, `pan-intent.ts`, `use-board-gestures.ts` with its test and probes) and `use-board-gestures.test.tsx` passes: tap → cell with `selected: null`, drag → one drag-end, a lifted drag's hover and drop on the same cell, swipe → one direction, hover on change only, long press → cell, stick → integer commands.
- [ ] The game's `apps/<game-id>/src/rules/intent-to-move.ts` is pure, lists every intent kind, returns only moves `listMoves` lists, and its test covers each used kind, illegal targets, a won and a lost state and a `listMoves` property (plus select-region taps for tap-then-tap games).
- [ ] A board with a drag lift proves "the ghost cell is the placed cell" and that every edge row is reachable in each layout.
- [ ] `hit-targets.test.ts` proves every hit region is ≥ 44 pt on a 402 × 874 pt phone (games with tappable regions).
- [ ] No gesture builder outside `use-board-gestures.ts`, no `Pressable` inside the board's `GestureDetector`, and the app root has `GestureHandlerRootView`.
- [ ] `npx tsc --noEmit`, `npx eslint --max-warnings 0` and `npx prettier --check` pass on the new files; no `__GAME_…__` placeholder is left.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-board-input.mjs .` prints `RESULT: PASS`

## Anti-patterns

- **A `Gesture.Tap()` in a game component or screen.** It bypasses hit-testing and the single-intent rule; add a mode to `useBoardGestures` instead.
- **A `select` move or a `selected` field in game state for tap-then-tap.** Bots, par and undo would see it and the contract test fails; list the region in `selectRegions` and read `intent.selected`.
- **Adding a lift in `intentToMove` or `drawGhost` (`row - 1`).** The ghost and the placed block drift apart and an edge row becomes unreachable; set `dragLiftPt` on the board instead.
- **Checking legality in the gesture worklet.** Worklets cannot call the pure engine safely and bots would disagree with players; return the intent and let `intentToMove` decide.
- **Emitting intents from `onUpdate` "for responsiveness".** One drag becomes many moves. Show responsiveness through the pointer ghost; emit on release.
- **Mirroring `event.x` for RTL.** The layout already mirrors positions for boards that opt in; flipping again sends touches to the wrong cell.
- **Feeding a float angle or velocity into a sim or into state.** Quantise to integers (stick commands, thousandths of a unit vector).
- **Growing hit areas with `hitSlop` on the canvas or shrinking the test's grid to pass 44 pt.** Fix the layout; the slop is the fixed 8 pt `HIT_SLOP`.
- **Spying on a mocked shared value** (`jest.spyOn(sv, 'set')`): the mock's methods are read-only. Pass a recording stand-in.
- **A new helper for a gesture callback in a plain module.** It passes every Jest test and crashes on the first touch on device; put it in a `'worklet'` module.
- **Mixing v3 hooks with v2 builders during an upgrade.** They cannot be related; migrate `use-board-gestures.ts` in one commit.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/input-pipeline.md](references/input-pipeline.md) | Pipeline, InputIntent, hitTest, composition and thresholds, pan modes per game, pointer/hover, RTL, 44 pt, a11y and E2E taps | Workflow step 1, before any input work |
| [references/intent-to-move.md](references/intent-to-move.md) | Rules and patterns for `intentToMove` (place, slide, aim, select-then-target, flag) and its tests | Step 3 |
| [references/testing-gestures.md](references/testing-gestures.md) | Jest set-up, what each test proves, driving gestures, mock traps | Step 6, and when a gesture test misbehaves |
| [references/stick-input.md](references/stick-input.md) | Integer stick commands for real-time games and their tests | Step 1 for real-time games |
| [references/rngh-v3-migration.md](references/rngh-v3-migration.md) | Gesture Handler 2.32 today, the v3 hook mapping and the one-file migration | When upgrading Expo or reading v3 examples |
| `templates/game-kit/` | `contract/input-intent.ts` (synced from the library; the shared contract file owned by `game-rules-engine`), `geom/classify-swipe.ts` (+ test), `geom/stick-command.ts` (+ test) | Step 2 (copy verbatim to `packages/game-kit/src/`) |
| `templates/shell/game-host/` | `pan-intent.ts` (+ test), `use-board-gestures.ts` (+ test), `board-gesture-probe.tsx`, `stick-gesture-probe.tsx` | Step 2 (copy verbatim to `packages/shell/src/game-host/`) |
| `templates/game/rules/` | `intent-to-move.ts` and its test for the Tap Flip template game (`__GAME_ID__`/`__GAME_PASCAL__` placeholders) | Step 3 |
| `templates/game/board/` | `hit-targets.test.ts` (44 pt on a 402 × 874 pt phone) | Step 4 |
| `examples/line-siege/` | Line Siege v1, synced from the library's canonical copy: `rules/intent-to-move.ts` (+ test: drag-end tray → board and tap-then-tap with `selected`), `rules/line-siege-types.ts`, `board/layout-board.ts` (`DRAG_LIFT_PT`), `board/hit-targets.test.ts` (board and tray 44 pt, edge rows reachable) and `board/drag-lift.test.ts` (ghost cell = placed cell) | Steps 3 and 4, as a model |
| `examples/flock-tilt/` | Swipe-to-tilt `intentToMove` that refuses wasted swipes, with test | Step 3, for swipe games |
| `examples/bank-shot/` | Aim-to-shoot `intentToMove` with integer aim, with property test | Step 3, for aim games |
| `scripts/check-board-input.mjs` | Checks the input kit, its `'worklet'` modules, one gesture file, test ids, single intents, slop, physical coords, detector children, root view, pure exhaustive intentToMove, touch-target tests, API version, `scheduleOnRN` and `.get()/.set()` | Steps 2 and 8 and at the end |
| `scripts/selftest.mjs` | Proves the checker passes the good fixture and catches each planted bug | After changing the checker |
| `scripts/lib/` | `source-scan.mjs`, TypeScript source helpers for the checker | When changing the checker |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/shared.json` | Declares the shared files this skill copies in | When adding a shared file |
| `tests/build-fixtures.mjs` | Rebuilds `tests/fixtures/` from the templates (the composed input kit plus the Tap Flip `intentToMove` and hit-target test) and plants one bug per case; `--check` proves the good fixture still equals the templates (the self-test runs it first) | After changing a template or the checker, before the self-test |
| `tests/fixture-base/` | What the templates do not ship: stand-ins for files other skills own (`board-layout.ts`, `board-types.ts`, `board-canvas.tsx`, the layout probe, the Tap Flip rules and layout), the app root, the app's `package.json`, a real-time board | When changing the fixture builder |
| `tests/fixtures/` | Good and planted-bad inputs for the checker, plus a `game-first/` suite (`shell-slice.json` `"screens": []`, run with `--game tap-flip`) where `gesture-root` prints SKIP | When adding a rule to the checker |

## Related skills

- `board-rendering-skia` - the board picture, `BoardLayout` and `PointerSample` this skill hit-tests against (load both for a playable board).
- `realtime-game-loop` - the fixed-step loop that consumes stick commands and records them for replays.
- `game-rules-engine` - `listMoves`, `applyMove` and the GameModule contract `intentToMove` belongs to.
- `game-host-integration` - the Game screen that dispatches moves and shows legality previews.
- `accessibility` - alternatives for hold actions and the board's spoken summary.
- `e2e-maestro` - tapping board cells by coordinates from the published board layout.
- `expo-sdk-upgrade` - the SDK move that brings Gesture Handler 3.
