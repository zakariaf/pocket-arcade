# Worklet rules and API traps (SDK 57 stack)

What training data gets wrong about Skia 2.6.2, Reanimated 4.5.1, Worklets 0.10.1 and Gesture Handler 2.32, and the rules for code that runs on the UI thread. Read this before writing any worklet, frame callback or Skia call, and when something works in Jest but crashes on device.

## Contents

- Worklet rules
- API churn table
- Re-verify when versions move

## Worklet rules

- **File-level directive.** `'worklet';` as the first statement (after the `// path` comment) workletises every top-level function of the file. Verified with SDK 57's `babel-preset-expo` 57.0.13 and Worklets 0.10.1: a directive file produced one worklet per top-level function, a file without it none; draw, layout and timeline modules ran on the UI thread in a Release build with React Compiler on. Files that must carry it: `packages/game-kit/src/{rng,geom,timeline}/*.ts`, `apps/*/src/board/{draw,layout}*.ts` (and helpers they call, like `board-ids.ts`), `apps/*/src/sim/**`, and the Shell's `board-scene.ts`, `run-board-frame.ts`, `record-board.ts`, `describe-error.ts`, `draw-centered-text.ts` (plus the input kit's `pan-intent.ts`, called from gesture callbacks, and the real-time loop's `run-loop-frame.ts` and `record-sim.ts`).
- **Imports.** A worklet can call another worklet imported from a `'worklet'` module (it is captured in its closure). It cannot call a plain JS function: that throws on the UI thread at runtime. Type-only imports are erased and always fine. `react-native-worklets` itself (`scheduleOnRN`) is allowed.
- **Closures are copies.** Values captured by a worklet are copied when it is first scheduled; later reassignments on JS are invisible. Anything that changes goes through a shared value.
- **Skia host objects are shared, not copied.** Paints, fonts, paths, paragraphs, pictures and the recorder captured in the kit are fine.
- **No third-party code on the UI thread** (Worklets Bundle Mode is not enabled), no promises, no `await`, no `setTimeout` in worklets.
- **Not hoisted.** Helper worklets must exist before they run; module-level functions satisfy that automatically.
- **Frame callbacks.** `useFrameCallback((info) => { runBoardFrame(wiring, info.timestamp); }, false)`: start inactive, keep the body ONE call into a runner that holds the `try/catch`.
- **UI → JS** only with `scheduleOnRN(fn, ...args)`; the callback must itself be a worklet when it runs on the UI thread (see `reportDrawError` in `board-canvas.tsx`, which has an inline `'worklet'` directive).
- **Shared values** only with `.get()` / `.set()`; for typed arrays mutated in place on the UI thread, call `sv.modify()` afterwards so listeners re-run.

## API churn table

| Area | Wrong (old) | Right (SDK 57 stack) |
|---|---|---|
| Skia paths | `const p = Skia.Path.Make(); p.addCircle(…)` | `Skia.PathBuilder.Make().moveTo().lineTo().close().build()`, `Skia.Path.Circle(x, y, r)`; transform a copy with `Skia.PathBuilder.MakeFromPath(path).transform(m).build()` or draw with `canvas.scale/translate` |
| Skia text width | `font.measureText(t).width` | glyph widths (`draw-centered-text.ts`); `measureText` is unimplemented in CanvasKit (a `jest.fn` in Jest, a throw in Node) |
| Skia canvas size | `<Canvas onLayout>` | `<Canvas onSize={sharedValue}>` or `useCanvasSize()` |
| Skia colours | Reanimated `interpolateColor` | Skia `interpolateColors` (different colour format) |
| Skia text direction | `textDirection: isRtl && TextDirection.RTL` | `TextDirection.RTL === 0` is falsy; choose explicitly |
| Skia object creation | `Skia.Paint()` inside the per-frame worklet or at module import | once, on JS, in the kit (the recorder: `useState(() => Skia.PictureRecorder())` per canvas) |
| Worklets → JS | `runOnJS(fn)(args)` | `scheduleOnRN(fn, ...args)`; `scheduleOnUI` replaces `runOnUI` |
| Shared values | `sv.value = x` | `sv.set(x)`, `sv.get()` (React Compiler needs the accessors) |
| Frame time | `timeSinceFirstFrame` for animation time | `info.timestamp` + the `startAt` sentinel |
| Reduced motion | `useReducedMotion()` for live changes | it is read once at module load; pass the Shell setting to `buildTimeline(events, motion)` |
| Mirroring | `transform: [{ scaleX: -1 }]` on the board | `isMirroredInRtl` + mirrored positions in `BoardLayout` |
| Worklets Bundle Mode | import any library inside worklets | not enabled; keep UI-thread code self-contained |
| Skia install scripts | nothing to approve | Skia 2.6.2 postinstall copies iOS xcframeworks: `npm approve-scripts @shopify/react-native-skia` |

## Re-verify when versions move

Moving to SDK 58 (Skia 2.11.x, Reanimated 4.7, Worklets 0.13, Gesture Handler 3.x):

1. `npx expo install --check` in every app; `npm view @shopify/react-native-skia version` (and reanimated, worklets, gesture-handler).
2. Re-read Reanimated's `FrameCallbackRegistryUI.ts` of the new version: does `timeSinceFirstFrame` still reset on re-activation? The sentinel fix works either way.
3. Re-run `npm test`: goldens will shift with a new Skia. Review every diff and re-accept one board at a time with `npx jest test/goldens/boards/<game-id>-board.golden.test.ts --selectProjects golden -u` (path first) and a `Gate-Change:` trailer.
4. Migrate `use-board-gestures.ts` to the Gesture Handler v3 hook API in one commit (the input skill has the mapping).
