# Testing a board: unit tests, draw-call budget, pixel goldens

How every board is proven before anyone looks at it on a phone. Read this when writing a board's tests or when a golden fails.

## Contents

- Three levels of proof
- Unit tests that come with the templates
- The draw-call budget and label assertions
- Pixel goldens: set-up
- Pixel goldens: writing and accepting
- When a golden fails
- Headless previews in plain Node
- On the simulator

## Three levels of proof

| Level | File | What it proves |
|---|---|---|
| Pure units | `sample.test.ts`, `board-scene.test.ts`, `present-move.test.ts`, `cue-scheduler.test.ts`, `build-timeline.test.ts`, `layout-board.test.ts` | timeline sampling, the startAt clock fix, fast-forward and cue order, turn budget and reduced motion, layout at any size |
| Draw calls | `apps/<game-id>/src/board/draw-board.test.ts` (Jest `unit` project) | the per-frame budget and every localised label |
| Pixels | `test/goldens/boards/<game-id>-board.golden.test.ts` (Jest `golden` project, CanvasKit) | the picture itself at 3 sizes × 3 moments |

Also in the repo, copied from `templates/tooling/quality/` with the host: the worklet boundary test (`packages/tooling/src/quality/check-worklet-boundary.test.ts`: a `'worklet'` module may import values only from other `'worklet'` modules or `react-native-worklets`; files under `game-kit/src/{rng,geom,timeline}`, `apps/*/src/board/{draw,layout}*` and `apps/*/src/sim/` need the directive) and `worklet-transform.test.ts` (`tickClock` has a `__workletHash`, proving the Babel plugin workletised the directive file). Both run inside `npm test`, so the boundary holds even in sessions that never run this skill's scripts. The Jest config skips `worklet-transform.test.ts` in Stryker mutation runs, which compile without the Worklets plugin.

## Unit tests that come with the templates

- `sample.test.ts`: before a hop starts the key holds its `from`; the latest started hop wins; the end lands exactly on `to`.
- `board-scene.test.ts`: fake `FrameInfo` sequences where `timeSinceFirstFrame` restarts at 0 after each activation; every pushed scene starts at elapsed 0; `isDone` exactly at `endMs`; a just-pushed scene draws t = 0.
- `present-move.test.ts`: cancel old cues → push the final view as scene `seq` with `startAt: NOT_STARTED` → schedule new cues.
- `cue-scheduler.test.ts` (fake timers): sounds scheduled on the audio clock, haptics at the track start, `cancel()` drops the rest.
- `build-timeline.test.ts`: turn budget, reduced motion (no `burst`, no `out-back`, shorter), cues, determinism.
- `layout-board.test.ts`: fast-check over canvas sizes and mirroring; cells inside the canvas; `hitTest ∘ cellRect = identity`.

Gesture tests and the 44 pt hit-target test come with the `board-gestures-and-input` skill.

## The draw-call budget and label assertions

`draw` receives every Skia object through `kit` and imports no Skia value, so it runs in the plain `unit` project (Skia's JSI module does not load there: "Native Skia Module failed to correctly install JSI Bindings!"). The test passes a `Proxy` canvas that counts every call and records `drawText` strings, stub paints and a stub font:

- **Budget**: sample the busiest turn mid-animation (`sampleTimeline(tracks, 300)`), draw once, assert `total ≤ DRAW_CALL_BUDGET` (the game's own number, never above 1,000) and that the effect layer actually drew (`drawCircle > 1`).
- **Labels**: assert `recorded.texts` equals the localised strings (`['۱۲']`). A two-digit label is about 0.035 % of a phone board (77 of 218,400 pixels), below the 0.1 % golden tolerance, so pixels alone would miss a missing number.
- **Pointer layers**: with `pointer.isDown` and a hovered cell, the ghost adds its draw call, on exactly the hovered cell (the gesture layer already applied the lift).
- **Moment 0**: at `atMs: 0` no effect layer that starts later draws (the template counts only the cells' faces, edges and marks; Line Siege asserts no beam, wave, flash, burst or shake).
- **Highlight**: with a `BoardHighlight` (`selected`, `hinted`) the ring or hinted ghost adds its draw calls; with `EMPTY_HIGHLIGHT` nothing extra is drawn.

## Pixel goldens: set-up

- `jest.config.js` has exactly two projects: `unit` (preset `jest-expo/ios`) and `golden` (`testEnvironment: '@shopify/react-native-skia/jestEnv.js'`, `setupFilesAfterEnv: ['@shopify/react-native-skia/jestSetup.js']`, `testMatch` `*.golden.test.ts`). Skia's environment replaces React Native's export conditions, so it must not be global.
- `test/goldens/boards/skia-golden.ts` (template) configures jest-image-snapshot 6.5.2: `failureThreshold: 0.001`, `failureThresholdType: 'percent'` (0.1 % of pixels), diffs written to `reports/visual/diff/`. Changing this file needs a `Gate-Change:` trailer.
- Board goldens read the font with `node:fs` and use `Buffer`, and Node APIs are banned under `apps/*/src`, so they live in the root `test/goldens/boards/` (whose tsconfig has Node types).
- The font file is the app's own `apps/<game-id>/assets/fonts/Vazirmatn-Regular.ttf`, loaded with `Skia.Typeface.MakeFreeTypeFaceFromData`.

## Pixel goldens: writing and accepting

The template renders through `paintBoardPng(Skia, request)`, which runs the SAME `draw()` and `layout()` the device runs on an offscreen `Skia.Surface`, at:

- three sizes: `phone-portrait` 390 × 560, `tablet-landscape` 1024 × 700, `small` 320 × 400;
- three moments of the busiest turn: 0, 50 % and 100 % of `timelineEndMs(tracks)`;
- the dark scheme (add light or mirrored cases when the game draws them differently).

Snapshot ids are `<game-id>-<size>-<moment>`, stored as `test/goldens/boards/__image_snapshots__/<game-id>-<size>-<moment>.png`.

Accepting baselines is deliberate:

1. `npx jest test/goldens/boards/<game-id>-board.golden.test.ts --selectProjects golden -u` writes them (only this command writes; `jest --ci`, which every script uses, refuses to write a new snapshot).
2. Open every new PNG with the Read tool and check it against the intended look:
   - **moment 0 shows no effect that starts later**: the board as it was before the move (old positions, cleared lines still full, lost hearts still full), and no flash, wave, beam, glow, burst or shake yet (an effect drawn at moment 0 means a layer skips the `isPlaying` guard: `ageMs > 0`);
   - moment 0.5 shows the effects mid-flight;
   - moment 1 shows the final state (the view), with nothing left of the effects;
   - nothing is clipped at `small`, and the wide canvas rearranges rather than shrinks.
3. Commit with a `Gate-Change: <reason>` trailer (`__image_snapshots__/**` is a gated path).
4. `CI=1 npx jest --ci --selectProjects golden` must pass afterwards.

The skill's `examples/line-siege/goldens/` holds the 9 reviewed Line Siege baselines of its busiest turn (a row and a column clear, a beam defeat with its burst, a march, a breach and a spawn), dark scheme, Persian digits. Moment 0 shows the board before the move plays: the cleared row and column still full, the defeated and the breaching monster still in their lanes, three full hearts, and no beam, wave, flash or burst. Moment 0.5 shows the lines gone, the burst in lane 7 and the breaching monster fading into the wall. Moment 1 is the view: the breached heart an empty outline, the marched monster one row closer, the new fast monster at the far end. A golden set whose three moments all look alike means the timeline sample is not reaching `draw()`.

## When a golden fails

The failure reads like `Expected image to match or be a close match to snapshot but was 3.7083333333333335% different from snapshot (6408 differing pixels)`, and the diff PNG is in `reports/visual/diff/`. Open the diff. If the change is a bug, fix the code. If it is intended, re-accept with `-u` and a `Gate-Change:` trailer. Never raise the tolerance to hide a diff. CanvasKit renders are byte-identical run to run, so a golden that varies between runs means the draw path reads time or randomness.

## Headless previews in plain Node

For board previews outside Jest (the owner's gallery, store art), the same draw modules load in plain Node because they import only Skia types:

```ts
// packages/tooling/src/visual/load-headless-skia.ts
import headless from '@shopify/react-native-skia/lib/commonjs/headless/index.js';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/commonjs/web/LoadSkiaWeb.js';

import type { SkiaApi } from '@e07/shell/game-host/board-types.ts';

export async function loadHeadlessSkia(): Promise<SkiaApi> {
  await LoadSkiaWeb();
  return headless.getSkiaExports().Skia as unknown as SkiaApi;
}
```

Then call `paintBoardPng(skia, …)` and compare with pixelmatch 7.2.0 (`threshold: 0.1`, max diff ratio 0.001). Run with `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON <script>.ts` (Node type stripping; do not add `"type": "module"` to Expo apps).

## On the simulator

Jest proves logic and pixels; a Release simulator build proves Metal rendering, fonts and real timing. After the goldens pass, build the app in Release for the simulator, open a level, make a move, and take `xcrun simctl io <udid> screenshot` in each of the four languages (the screenshot matrix of the e2e skill). The simulator caps at 60 fps and is not a device: frame timing on ProMotion is checked by the owner with the frame-time recorder.

End-to-end flows cannot see inside the canvas (it has no accessibility children), so the board host publishes its geometry in test builds. `board-layout-probe.tsx` (template, with its test) wraps the canvas in a frame and renders one small `AppText` with testID `game.board-layout` whose text is `boardLayoutText(origin, layout)` = `JSON.stringify({ x, y, layout })`: `x` and `y` are the frame's top-left corner in window points (`measureInWindow` after its layout event) and `layout` is the canvas's current `BoardLayout` (regions in canvas points, unmirrored, plus `isMirrored`), read from the layout shared value with `useAnimatedReaction` (it changes only with the canvas size or the view, never per frame). Nothing shows until the canvas has a size, so a flow never reads the empty layout.

Wiring: `GameBoardHost` and `BoardCanvas` take `isLayoutProbeOn?: boolean`. The Shell's board host factory passes `true` only in a test build whose debug link set `boardLayout=1`, or during a parity launch with `probe=board` (the host's `isLayoutProbeOn` closure is also true while `isParityBoardProbeOn()` is; the debug and parity state live in the test-only code); store builds never pass it, so their canvas renders exactly as before. It is off by default, so screenshots never show it. The e2e skill owns the flows and the tap maths (`x + region.x + (col + 0.5) * region.cell`, mirrored: `x + layout.width - region.x - (col + 0.5) * region.cell`).

**Parity uses the probe too.** The Game, Pause and Result screens (S5, S6, S7) have no board reference, because every game brings its own board, so their visual parity compares only the Shell chrome and the overlays and masks the board. The capture first launches the frame with the parity parameter `probe=board`, which turns the probe on and opens no frame state, reads `game.board-layout` once (the canvas origin and `BoardLayout` in window points), then launches the real capture and masks the union of that rectangle and the reference's `game.board` rectangle in both images. The probe text must therefore stay inside the board frame: the frame clips (`overflow: 'hidden'`) and the text box spans it from start to end (`insetInlineStart: 0`, `insetInlineEnd: 0`), so a long layout text wraps inside the masked area and never lands on the chrome being compared. The template's test proves this, and `check-board-files.mjs` fails `probe-contained` for a probe that could spill.
