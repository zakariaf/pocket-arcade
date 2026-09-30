# The fixed-step loop on the UI thread

How a real-time game (Halo Drift) advances its world in fixed ticks on the UI thread, shows it every frame, and stops safely. Read this before touching `fixed-step.ts`, `run-loop-frame.ts`, `use-fixed-step-loop.ts`, `record-sim.ts` or `realtime-board-host.tsx`.

## Contents

- Why fixed steps on the UI thread
- The accumulator
- The loop runner and hook
- Showing the sim: the real-time host
- Lifecycle, pause and save points
- Many sprites
- 120 Hz, the simulator and the frame recorder
- What is verified and what is not

## Why fixed steps on the UI thread

- **Fixed steps:** gameplay advances in ticks of `STEP_MS = 1000 / 120` ms. Results depend on tick counts, never on 60 vs 120 Hz or on how frames happened to fall, so a recorded run replays bit-exactly in Jest.
- **UI thread:** the loop runs in a Reanimated frame callback (a worklet), so a busy JavaScript thread (a save, a React render) never stutters the world.
- **No physics engine:** the in-house geometry kit (vec2, swept circles, spatial hash) covers every catalogue game. If a future game needs stacking, joints or friction, the documented fallback is `planck` 1.5.0 on the JS thread, with replays treated as approximate.

## The accumulator

```ts
// packages/game-kit/src/timeline/fixed-step.ts ('worklet')
export const STEP_MS = 1000 / 120;
export const MAX_FRAME_MS = 250;   // longest gap caught up on: background, ads, a GC pause

export function planSteps(accMs: number, frameDtMs: number | null): StepPlan {
  const dt = frameDtMs === null ? 0 : Math.min(Math.max(frameDtMs, 0), MAX_FRAME_MS);
  let acc = accMs + dt;
  let steps = 0;
  while (acc >= STEP_MS) { acc -= STEP_MS; steps += 1; }
  return { steps, accMs: acc };
}
```

- `frameDtMs` is `FrameInfo.timeSincePreviousFrame`, which is `null` on the first frame after (re)activation: that frame simulates nothing, so a resumed sim never jumps.
- A 120 Hz frame runs one tick, a 60 Hz frame two; the remainder carries to the next frame.
- The 250 ms clamp caps catch-up after a stall at 30 ticks.

## The loop runner and hook

`runLoopFrame(wiring, info.timeSincePreviousFrame)` is the whole frame-callback body:

1. `planSteps(accMs, dt)`; store the new `accMs`; return when there are no steps.
2. Read the command once (`command.get()`, an integer written by the stick gesture) and the sim (`sim.get()`: on the UI thread this is the live object, not a copy).
3. `step(sim, command)` for each planned tick: the sim mutates its typed arrays in place.
4. `drainEvents(sim)`, then `sim.modify()` so listeners (the board picture) re-run: in-place mutation does not notify by itself.
5. If there are events, send them to JS once: `scheduleOnRN(onEvents, events)` (sound, HUD, stats, save points).
6. All of it inside `try/catch`; an error goes to `scheduleOnRN(onError, describeError(error))`, which stops the loop and pauses the game (an uncaught UI-thread exception kills the app).

`useFixedStepLoop({ sim, command, game, onEvents, onError })` owns `accMs`, creates the frame callback inactive (`useFrameCallback((info) => { runLoopFrame(wiring, info.timeSincePreviousFrame); }, false)`), keeps it in a ref assigned in an effect (so the error handler can stop it without a temporal-dead-zone access), and returns `{ start, stop }`; `start` resets the accumulator.

## Showing the sim: the real-time host

`RealtimeBoardHost` (template `realtime-board-host.tsx`) is the board area of S5 for a real-time game:

- `sim = useSharedValue(initialSim)` (created by the Game screen with `createSim(seed, level)` or restored from a save point), `command = useSharedValue(0)`, the canvas size from `<Canvas onSize={size}>`, one `PictureRecorder` per canvas (`useState`).
- `picture = useDerivedValue(() => recordSim(recorder, { sim: sim.get(), width, height, colors, kit, draw, onError }))`: it re-runs whenever the loop calls `sim.modify()`, and `draw` reads the typed arrays in place.
- The game's `draw` is a `'worklet'` module in `apps/<game-id>/src/board/` (template `draw-arena.ts`): it scales the square world to the canvas with a margin of one body radius, so an edge body is never clipped (free-form worlds need no `BoardLayout` regions), sets the kit paints and draws; it allocates no Skia objects and reads no clock.
- The input gesture comes in as a plain builder prop: `makeGesture={makeStickGesture}` (the input skill), called with the `command` shared value.
- The canvas is one accessible image with a translated label, like every board.
- The board is proven like every board, headless. `draw-arena.test.ts` (template) passes a counting `Proxy` canvas and stub paints: the fullest frame (every entity slot in play) stays within the game's `DRAW_CALL_BUDGET` (never above 1,000) and every body lands inside the canvas at three sizes. The pixel golden (`test/goldens/boards/<game-id>-board.golden.test.ts`, Jest `golden` project, CanvasKit) steps the sim with a scripted bot to 0, 50 % and 100 % of `RUN_TICKS` and renders it through `paintSimPng(Skia, { draw, sim, width, height, colors, kit })`, the offscreen twin of `recordSim`, at 390 × 560, 1024 × 700 and 320 × 400 (snapshot ids `<game-id>-<size>-<moment>`, 0.1 % tolerance from `skia-golden.ts`). Accept baselines only with `npx jest test/goldens/boards/<game-id>-board.golden.test.ts --selectProjects golden -u` (path first) after opening every PNG, with a `Gate-Change:` trailer. Same seed and bot give the same world, so a golden that varies between runs means the sim or the draw reads time or randomness.

## Lifecycle, pause and save points

`useGameLifecycle` (the rendering skill's one lifecycle hook) decides whether the board may run: app active AND screen focused AND no full-screen ad. The real-time host passes `isFocused && !isPaused && !isEnded`, so:

| Event | What happens |
|---|---|
| A drained batch holds a save-point event (`isSavePoint(events)`, e.g. wave end) | `onSavePoint(sim.get())` (a synchronous JS copy taken between frames), then `onEvents(events)`; the loop keeps running |
| Player taps Pause, app goes to background, an ad shows, the screen loses focus | `loop.stop()`, `onSavePoint(sim.get())` (a JS copy), `onAutoPause()` (the Game screen shows Pause, S6) |
| Back to foreground, ad closed, focus returns | nothing: real-time games never auto-resume |
| Player taps Resume (`isPaused` false) | `loop.start()` (accumulator reset; the first frame simulates nothing) |
| A batch holds the run's end (death, time up) | the Game screen records the run end (outcome from `realtime.snapshot(sim copy)`, stars, statistics) and sets `isEnded`: `loop.stop()` with no save point and no Pause; the result is shown |

Save points are end of wave, pause, background and blur: never per frame. Save `realtime.snapshot(copy)` together with the recorded input log, so a restore can also be replayed. When the host mounts already paused (a restored run), the lifecycle hook runs the pause path once: one extra save point, which is harmless. Everything in gameplay counts ticks (`ints[TICK]`), never milliseconds.

## Many sprites

Up to about a hundred bodies: one draw call each in the picture. Hundreds of identical sprites: pre-render the sprite once per theme into a sheet (the art skill's sprite cache) and draw them as one atlas call. The template host renders a single `<Picture>`, so draw the atlas inside `draw()`: the kit holds (widen `RenderKit` for it when the first atlas game is built) `MAX_ENTITIES` `SkRSXform`s built once on JS (`skia.RSXform(1, 0, 0, 0)`) and one source rect per slot (plain `{ x, y, width, height }` objects); `draw` updates them in place with `xform.set(scale, 0, x, y)` (slots not in play get scale 0) and calls `canvas.drawAtlas(sheet, srcs, xforms, kit.fill)`. Verified in the CanvasKit Jest environment inside a recorded Picture (not yet on a device). The declarative `<Atlas image sprites transforms />` with `useRSXformBuffer` is the alternative when a host renders it as a second canvas child. The per-game draw-call budget still applies (≤ 1,000).

## 120 Hz, the simulator and the frame recorder

- `withShell` sets `CADisableMinimumFrameDurationOnPhone = true`; Reanimated already requests 120 fps. The simulator caps at 60 fps.
- Verified on the simulator: 31 entities for 10 s at a steady 115.9 ticks/s while the display ran at 60 fps (target 120 ticks/s), with hit events delivered to JS and every frame rendered. Gameplay is unaffected (it counts ticks), but real-time speed on a device must be checked by the owner with the frame-time recorder; if a device also runs slow, compare `FrameInfo.timestamp` deltas with wall time before changing `planSteps`.
- In test builds, `sampleFrame(histogram, isRecording, info.timeSincePreviousFrame)` is the first statement inside the `try` of `runLoopFrame` (the recorder never owns a frame callback). A real-time play test of at least 60 s must stay at a hitch rate ≤ 10 ms/s.

## What is verified and what is not

- Verified (Jest, lint, types, and on the simulator for the loop): `planSteps`, `runLoopFrame`, `useFixedStepLoop`, typed arrays in a shared value mutated in place with `sim.modify()`, events to JS, replay and frame-grouping determinism.
- Compiled, linted and unit-tested, not yet run on a device: `record-sim.ts`, `paint-sim-png.ts` (through the golden) and `realtime-board-host.tsx` (Halo Drift is not built yet). `realtime-board-host.test.tsx` proves the lifecycle with Skia, the loop hook and the app-active hook mocked: the loop starts only when runnable; background stops it, saves and shows Pause and it never resumes by itself; `isEnded` stops it with no save or Pause; a save-point batch is saved before it is handed on. The first time a real-time game ships, run it in a Release simulator build and confirm the picture updates every frame and Pause stops the loop, before relying on it.
