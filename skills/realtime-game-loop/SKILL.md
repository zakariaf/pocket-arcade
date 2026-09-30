---
name: realtime-game-loop
description: Runs real-time play - fixed-step UI-thread loop, typed-array sims, (tick, command) replays, simulate-then-replay, swept circles, spatial hash. Use when building Halo Drift, Bank Shot, bouncing balls or live motion. Not for turn animations (board-rendering-skia) or touch (board-gestures-and-input).
---

# Real-time game loop

Real-time play in Pocket Arcade advances in fixed ticks of 1/120 s, never in frame time: Halo Drift runs a typed-array sim on the UI thread inside a Reanimated frame callback, and Bank Shot-style games run their continuous phase inside `applyMove` and replay it as a timeline. Either way a recorded run replays bit-exactly in Jest. This skill builds the loop kit, each sim, the simulate-then-replay phase and the checks that prove them.

## Rules that must hold

1. **Simulate in fixed steps of `STEP_MS = 1000 / 120` with a 250 ms catch-up clamp;** the first frame after (re)activation simulates nothing. Why: results depend on ticks, never on 60 vs 120 Hz or frame timing, and a resumed sim never jumps.
2. **Gameplay counts ticks, never milliseconds:** speeds are per tick, timers are tick counts, the sim never sees a timestamp. Why: tick counts are exact integers on every device.
3. **Sim state is one plain object of typed arrays in ONE shared value, mutated in place on the UI thread, then `sim.modify()`.** Why: no per-frame copies or allocations, and in-place mutation does not notify the picture by itself.
4. **A tick allocates nothing:** buffers (entities, events, RNG words, spatial-hash scratch) are created once in `create…Sim`; a full event queue drops events; tick code does scalar maths on the typed arrays (the `vec2`/`sweep` helpers return new objects and belong to `applyMove`). Why: the loop may run 30 ticks in one frame on the UI thread.
5. **Sims, the loop kit and the geometry kit are `'worklet'` modules that import values only from other `'worklet'` modules.** Why: a plain JS function called on the UI thread throws at runtime, not at build time.
6. **Obey the determinism policy:** only `+ - * / %`, bitwise, `Math.sqrt/imul/floor/round/abs/min/max/PI`; no `**`, no other `Math.*`, no `Math.random`, `Date`, `performance.now`, `Intl`; randomness from the sim's own sfc32 words. Why: Hermes and V8 compute transcendental functions differently, so replays and daily seeds would diverge.
7. **Input is an integer command recorded as `(tick, command)`,** from the committed 16-direction table (1 right, 5 down, 9 left, 13 up; 0 idle). Why: only integer logs replay bit-exactly; the same table sits in the stick gesture.
8. **The sim never talks to JS itself:** it appends `[kind, value, tick]` events; `runLoopFrame` drains them once per frame and sends one batch with `scheduleOnRN`. Why: one bridge crossing per frame, and the sim stays testable in plain Jest.
9. **The frame-callback body is one call to `runLoopFrame`, which holds the `try/catch`;** errors stop the loop and pause the game. Why: an uncaught UI-thread exception kills the app, and React Compiler bails out of hooks with value blocks inside `try/catch`.
10. **The loop runs only while the board may run** (app active, screen focused, no full-screen ad, not paused); stopping takes a save point (a JS copy of the sim plus the input log) and shows Pause; real-time games never auto-resume. Why: no simulation in the background, and killing the app loses at most the current wave.
11. **Every sim has a replay test and a frame-grouping test.** Why: they are the proof of determinism; everything else (saves, bots, bug reports) depends on it.
12. **Simulate-then-replay games run the continuous phase inside `applyMove` with the same fixed step and return timed events (`atMs`),** capped by `maxTicks`. Why: the game stays turn-based for saves, undo, bots and goldens; only the picture moves in real time.
13. **A real-time board is proven like every board:** a draw-call budget test with every entity slot in play (≤ 1,000) and pixel goldens through `paintSimPng` at 3 sizes × moments 0, 0.5, 1 of a scripted run. Why: the loop's tests prove the numbers, not the picture; the golden catches a draw that scales, colours or clips wrongly.
14. **No physics engine:** swept circles, `reflect` and the spatial hash cover the catalogue. Why: engines bring non-deterministic floats and a second runtime; `planck` 1.5.0 on JS is the documented fallback only for stacking, joints or friction.

## Workflow

1. **Classify the game.** Real-time (Halo Drift): read [references/fixed-step-loop.md](references/fixed-step-loop.md) and [references/sim-design.md](references/sim-design.md). A continuous phase inside a turn (Bank Shot, Toggle Drop, cascades): read [references/simulate-then-replay.md](references/simulate-then-replay.md). Geometry needs: [references/geom-kit.md](references/geom-kit.md). The drawing rules, palettes and turn-based goldens come from `board-rendering-skia` (a real-time board's draw test and goldens are here); the stick gesture from `board-gestures-and-input`. These modules must already exist, because the templates import them: `packages/game-kit/src/rng/sfc32.ts` (`game-rules-engine`), and `packages/shell/src/game-host/board-types.ts`, `board-kit.ts`, `describe-error.ts`, `use-game-lifecycle.ts`, `packages/shell/src/app/use-is-app-active.ts` and `test/goldens/boards/skia-golden.ts` (`board-rendering-skia`).
2. **Check the kit.** Run `node ${CLAUDE_SKILL_DIR}/scripts/check-realtime-loop.mjs .` from the repo root. For every `loop-file-missing` copy the file verbatim: `templates/game-kit/X` → `packages/game-kit/src/X`, `templates/shell/game-host/X` → `packages/shell/src/game-host/X` (tests included).
3. **Real-time game, test-first:** copy `templates/game/sim/__GAME_ID__-sim.test.ts` and `__GAME_ID__-sim.ts` to `apps/<game-id>/src/sim/`, replace `__GAME_ID__` (kebab) and `__GAME_PASCAL__` (PascalCase) in names and contents, run the replay and frame-grouping tests, then replace the gameplay slot (`moveEntity`) with the game's rules, keeping both tests green after every change. Add event kinds as exported integer constants.
4. **Real-time board and its proof:** copy `templates/game/board/` (palettes with their `board-contrast.json`, `draw-arena.ts` and its draw-call budget test) to `apps/<game-id>/src/board/` and `templates/test/goldens/boards/__GAME_ID__-board.golden.test.ts` to `test/goldens/boards/<game-id>-board.golden.test.ts`, filling `__GAME_ID__`/`__GAME_PASCAL__`. Adapt the draw to the game (Atlas for hundreds of sprites) and set its own `DRAW_CALL_BUDGET`. Create the goldens deliberately: `npx jest test/goldens/boards/<game-id>-board.golden.test.ts --selectProjects golden -u`, open all 9 PNGs with the Read tool (bodies inside the canvas, nothing clipped at `small`), then `CI=1 npx jest --ci --selectProjects golden`; commit baselines with a `Gate-Change:` trailer.
5. **Wire the host:** render the board with `RealtimeBoardHost` from the Game screen: `initialSim={realtime.createSim(state)}`, `game={realtime}` (its `step` and `drainEvents`), `draw`, `makeGesture={makeStickGesture}`, `onEvents` (sound, HUD, stats, input log), `isSavePoint={realtime.isSavePoint}`, `onSavePoint` (save `realtime.snapshot(copy)` with the input log), `onAutoPause`, `isPaused`, `isEnded` (set when a batch reports the run's end, so the loop stops without a Pause), `onFailure`. `realtime` is the game module's `RealtimeSpec` ([references/sim-design.md](references/sim-design.md), last section).
6. **Simulate-then-replay game:** imitate [examples/bank-shot/](examples/bank-shot/): a pure `simulate…` function in `apps/<game-id>/src/rules/` called by `applyMove`, events with `atMs`, a `…Tracks(events)` builder used by `buildTimeline`, and the property tests (inside the arena, never faster, same shot same volley, tracks replay the path).
7. **Lint, format and type-check:** `npx eslint --fix` and `npx prettier --write` on the new files, then `npx tsc -p apps/<game-id> --noEmit`; run `npx jest apps/<game-id> packages/game-kit/src packages/shell/src/game-host --ci --selectProjects unit --coverage --collectCoverageFrom='apps/<game-id>/src/**/*.ts' --coverageThreshold='{}'` (paths first: `--selectProjects` takes several values and would swallow them; only `npm run test:coverage` judges the thresholds).
8. **Run the check** `node ${CLAUDE_SKILL_DIR}/scripts/check-realtime-loop.mjs .`, fix every `FAIL` line (each names the file, the rule and the fix) and rerun until it prints `RESULT: PASS`. In a repo whose every game module (`apps/<id>/src/index.ts`) says `realtime: null` and that has no sim, replay rules or loop kit, it prints `NOT APPLICABLE: ...` and `RESULT: PASS` (exit 0), which counts as a pass; with no game module at all it stops with exit 2.
9. **Play it for real.** The real-time host is compiled and its lifecycle unit-tested with Skia and the loop mocked, but it has not run on a device yet: on the first real-time game, run a Release simulator build and confirm the picture updates every frame, Pause and background stop the loop, and resume starts clean. The owner then plays at least 60 s on a ProMotion phone with the frame-time recorder on (hitch rate ≤ 10 ms/s) and judges the feel.

## Definition of done

- [ ] The loop kit exists (`fixed-step.ts`, `vec2.ts`, `sweep.ts`, `spatial-hash.ts`, `replay-commands.ts`; for real-time games also `run-loop-frame.ts`, `use-fixed-step-loop.ts`, `record-sim.ts`, `realtime-board-host.tsx` with its lifecycle test, `paint-sim-png.ts`) and its tests pass.
- [ ] Each sim is a `'worklet'` module of typed arrays that allocates nothing per tick, counts ticks, records `(tick, command)`, drains `[kind, value, tick]` events, and its replay and frame-grouping tests pass.
- [ ] Each real-time board has palettes (4 sets), a `'worklet'` draw, a draw-call budget test (≤ 1,000) and 9 reviewed golden PNGs that pass under `CI=1 npx jest --ci --selectProjects golden`.
- [ ] Each simulate-then-replay phase is pure, capped by `maxTicks`, emits `atMs` events, and its properties (inside the arena, never faster, deterministic, tracks replay the path) pass.
- [ ] The host stops the loop, saves and shows Pause on pause, background, blur and ads, and never auto-resumes.
- [ ] `npx tsc --noEmit`, `npx eslint --max-warnings 0` and `npx prettier --check` pass on the new files; no `__GAME_…__` placeholder is left.
- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/check-realtime-loop.mjs .` prints `RESULT: PASS`

## Anti-patterns

- **Moving entities by `dt` in milliseconds** (`x += speed * dt`). Frame timing leaks into gameplay and replays diverge; move per tick inside `step`.
- **Keeping the world in React state or copying it to JS every frame.** Keep it in the shared value; JS gets batched events and a copy only at save points.
- **Angles and `Math.atan2`/`Math.cos` in the sim.** Use committed unit-vector tables, dot products and `reflect`.
- **Calling `scheduleOnRN` from inside the sim, or once per event.** Queue events in the sim; the runner sends one batch per frame.
- **Growing arrays per tick** (`events.push` on a JS array, `new Float32Array`, `.map`). Pre-allocate in `create…Sim` and write in place.
- **A module-level `let` or array in a sim file** (a counter, a hit log). The UI thread works on its own captured copy, and saves and replays never see it; keep every changing value in the sim's typed arrays.
- **Auto-resuming a real-time game** when the app returns to the foreground. The player expects Pause; resume only on their tap.
- **Running a volley live in the frame loop instead of inside `applyMove`.** It breaks saves, undo, bots and goldens; simulate first, then replay the events.
- **A second frame callback for measurements.** The frame-time recorder hooks into `runLoopFrame`'s `try`; an extra callback keeps idle screens rendering.

## Files in this skill

| File | What it is | Read/run when |
|---|---|---|
| [references/fixed-step-loop.md](references/fixed-step-loop.md) | The accumulator, loop runner and hook, the real-time host, lifecycle and save points, sprites, 120 Hz, what is verified | Workflow step 1 for real-time games, and before touching the loop |
| [references/sim-design.md](references/sim-design.md) | Typed-array state, one tick, events, sfc32 words, the determinism policy, integer commands, replay tests, save points | Step 1 and step 3 |
| [references/simulate-then-replay.md](references/simulate-then-replay.md) | Continuous phases inside `applyMove`: fixed step, timed events, tracks, the collision recipe, discrete runs, tests | Step 1 and step 6 |
| [references/geom-kit.md](references/geom-kit.md) | `vec2`, `sweep`, `spatial-hash` APIs and rules for new geometry | Whenever a game needs vectors or collisions |
| `templates/game-kit/` | `timeline/fixed-step.ts` (+ test), `geom/vec2.ts` (+ test), `geom/sweep.ts` (+ test), `geom/spatial-hash.ts` (+ test), `testing/replay-commands.ts` (+ test) | Step 2 (copy verbatim to `packages/game-kit/src/`) |
| `templates/shell/game-host/` | `run-loop-frame.ts` (+ test), `use-fixed-step-loop.ts`, `record-sim.ts` (+ test), `realtime-board-host.tsx` (+ lifecycle test), `paint-sim-png.ts` (offscreen render for goldens and art) | Step 2 (copy verbatim to `packages/shell/src/game-host/`) |
| `templates/game/sim/` | `__GAME_ID__-sim.ts` skeleton and its replay and frame-grouping tests | Step 3 |
| `templates/game/board/` | Arena palettes (4 sets) and `board-contrast.json` (the pairs and piece colours the accessibility contrast check measures; list every colour `draw()` paints), `draw-arena.ts` for a free-form world and `draw-arena.test.ts` (draw-call budget, bodies inside the canvas) | Step 4 |
| `templates/test/goldens/boards/` | `__GAME_ID__-board.golden.test.ts`: the real-time board's pixel golden (3 sizes × moments of a scripted run) | Step 4 |
| [examples/halo-drift/](examples/halo-drift/) | The verified Halo Drift sim (player, chasers, hits) with its replay tests | Step 3, as the model to imitate |
| [examples/bank-shot/](examples/bank-shot/) | Simulate-then-replay volley with sweep and reflect, its tracks builder and property tests | Step 6 |
| `scripts/check-realtime-loop.mjs` | Checks the kit, step constants, runner, frame callback, worklets, determinism, tick time, isolation, per-tick allocation (helpers included), module-level state, replay tests, stick table, lifecycle, timed and capped replays, the real-time board's budget test and goldens; NOT APPLICABLE (a pass) when every game module says `realtime: null` | Steps 2 and 8 and at the end |
| `scripts/selftest.mjs` | Proves the checker passes the good fixture and catches each planted bug | After changing the checker |
| `scripts/lib/` | `source-scan.mjs`, TypeScript source helpers for the checker | When changing the checker |
| `scripts/check-lib.mjs` | Shared script helper, synced from the library (do not edit here) | Never by hand |
| `assets/shared.json` | Declares the shared files this skill copies in | When adding a shared file |
| `tests/fixtures/` | Good and planted-bad inputs for the checker, plus a `turn-based/` suite (every game module `realtime: null`: NOT APPLICABLE) | When adding a rule to the checker |

## Related skills

- `board-rendering-skia` - drawing, palettes, the lifecycle hook, turn timelines and pixel goldens.
- `board-gestures-and-input` - the stick gesture that writes integer commands, and aim intents.
- `game-rules-engine` - `applyMove`, events, the determinism policy and the sfc32 PRNG.
- `game-balance-and-bots` - thousands of seeded headless runs of the same `step` for difficulty curves.
- `game-host-integration` - the Game screen: Pause (S6), save points, HUD from events.
- `performance-budgets` - the frame-time recorder and the on-device hitch-rate budget.
