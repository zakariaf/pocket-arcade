# 08 · Game engine: rendering, animation, input and simulation

> **What this doc decides.** There is no third-party game engine. Every board is a Skia `<Canvas>` whose single `<Picture>` is recorded on the UI thread from a pure `draw()` function; Reanimated 4 drives the clock, Gesture Handler turns touches into `InputIntent`s, and a small in-house kit (`packages/game-kit` + `packages/shell/src/game-host`) supplies the timeline, fixed-step loop, board layout, hit-testing, geometry, particles and seeded PRNG.
> It fixes the layer contract (`create` · `listMoves` · `applyMove` · `outcome` · `intentToMove` · `buildTimeline` · `draw`), the corrected frame clock (one `scene` shared value, `startAt` stamped from `FrameInfo.timestamp`), the determinism and worklet rules, and how each of the 26 catalogue games maps onto it.
> Every code block below was compiled, linted and tested on 2026-09-26; the board, clock, loop, text and font paths also ran in a Release build on the iOS 26.5 simulator.
> **Related docs:** [02-architecture-and-folders.md](02-architecture-and-folders.md) (GameModule and ShellGameModule), [04-code-style-and-limits.md](04-code-style-and-limits.md) (determinism lint), [07-testing-and-tdd.md](07-testing-and-tdd.md) (goldens, sims, board E2E), [09-sound-haptics-art.md](09-sound-haptics-art.md) (sound, haptics, art), [10-i18n-and-rtl.md](10-i18n-and-rtl.md) (text and digits on boards), [15-performance-and-accessibility.md](15-performance-and-accessibility.md) (frame-time recorder). Start at [00-README.md](00-README.md); how a session works is [17-claude-code-playbook.md](17-claude-code-playbook.md).

## Intro

### For the owner, in plain words

We do not use a game engine such as Unity, Godot or Phaser. They each bring a second language or a second runtime (C#, GDScript, a web view), an editor that needs a person at the mouse, and a large binary, and none of them can be tested headlessly the way Claude Code needs. Our games are small 2D boards, so we draw them directly with the same tools the rest of the app uses:

| Job | Library | Why this one |
|---|---|---|
| Drawing the board (shapes, text, sprites) | **Skia** (`@shopify/react-native-skia`), the GPU 2D engine used by Chrome and Android | Draws hundreds of shapes per frame on the GPU; the exact same drawing code renders PNG test images on the Mac without a phone |
| Timing and animation (the 60/120 Hz "tick") | **Reanimated 4** + **Worklets** (Software Mansion) | Runs our frame code on the UI thread, so a busy JavaScript thread never stutters the board |
| Touch (tap, swipe, drag, long-press) | **Gesture Handler** (Software Mansion) | Precise gestures with board-local coordinates |
| Sound effects | **react-native-audio-api** (docs/09) | Synthesised sounds, started in sync with animations |
| Vibration | **expo-haptics** (docs/09) | Apple's Taptic Engine through one small wrapper |
| Everything game-specific | our own small kit | A turn = "apply the move, then play a short film of what happened"; a real-time game = "advance the world in fixed 1/120 s steps" |

All of it was built and run on 2026-09-26. The only two catalogue games that need more than "turn → animation" are Bank Shot (bouncing balls, computed in advance and then replayed) and Halo Drift (a real-time arena, simulated on the UI thread). Neither needs a physics engine.

### How to read this doc

Section 1 is the rules. Section 2 is the architecture with the code of every layer (copy it; it is the verified version). Section 3 is "build a new game", section 4 maps the catalogue, section 5 lists testing hooks, section 6 lists API traps that training data gets wrong. Names follow FINAL-DECISIONS section F and docs/03; import style, lint and limits follow docs/04 (`@e07/<package>/<path-under-src>.ts`, never `../`).

## 1. Rules

1. **Render every board with Skia: one `<Canvas>` per board, one `<Picture>` recorded in a `useDerivedValue` from the game's pure `draw()`.** Use `<Atlas>` only for hundreds of identical sprites (Halo Drift) and retained Skia nodes only for static art (how-to-play illustrations).
   *Why:* Skia's own guidance is "game with dynamic entities → immediate mode (Picture)", "fixed number of sprites → retained (Atlas)". *Source:* [Skia rendering modes](https://shopify.github.io/react-native-skia/docs/canvas/rendering-modes).
2. **Install the engine libraries only with `npx expo install` at the SDK 57 pins** (Skia 2.6.2, Reanimated 4.5.1, Worklets 0.10.1, Gesture Handler ~2.32.0); never bump them past Expo's map by hand. Re-verify with `npx expo install --check`.
   *Why:* Expo tests exactly this set; `expo-doctor` flags drift. *Source:* [SDK 57 bundledNativeModules.json](https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo/bundledNativeModules.json).
3. **Keep the engine functions pure and on the JS thread:** `create(seed, difficulty)`, `listMoves(state)`, `applyMove(state, move) → { state, events }`, `outcome(state)`, `intentToMove(state, intent)`, `buildTimeline(events, motion)`. They never touch React, React Native, Expo, Skia or the Shell.
   *Why:* bots, solvers, saves, undo and goldens all call them headlessly (spec 8.13). *Enforced by:* docs/04 `PURE` and `DETERMINISTIC` blocks.
4. **Make `draw(canvas, frame)` a pure worklet:** it reads only its arguments (`view`, `fx`, `colors`, `layout`, `kit`), allocates no Skia objects, reads no clock, and returns nothing.
   *Why:* the same function then runs in the Picture worklet, in Jest goldens and in headless Node art scripts with identical pixels.
5. **Push exactly ONE `scene` shared value per committed move:** `{ seq, view, tracks, endMs, startAt: NOT_STARTED }`. The frame callback stamps `startAt = FrameInfo.timestamp` on its first frame and measures `elapsed = timestamp − startAt`. Never use `timeSinceFirstFrame`.
   *Why:* Reanimated resets `timeSinceFirstFrame` to 0 whenever a frame callback is re-activated, which froze every animation after the first in the original wiring (verified in source and fixed on the simulator). *Source:* [FrameCallbackRegistryUI.ts @ 4.5.1](https://github.com/software-mansion/react-native-reanimated/blob/4.5.1/packages/react-native-reanimated/src/frameCallback/FrameCallbackRegistryUI.ts).
6. **Run a frame callback only while something moves.** The board clock stops itself when the scene's timeline ends; every loop stops on background, during a full-screen ad, and when the Game screen loses focus.
   *Why:* a Picture that reads the clock re-records every frame; idle boards must cost nothing (FINAL B.19).
7. **Save before animating:** the GameSession store applies and saves the move, then the board presents it. A move that arrives during an animation replaces the scene (fast-forward) and cancels the old cues; games whose animation carries information set their input policy to `queue`.
   *Why:* killing the app mid-animation must lose nothing (spec 8.6, N10).
8. **Route every board touch through `useBoardGestures(layout, handlers)`, the only file that imports gesture builders.** It emits at most one `InputIntent` per gesture; the game's `intentToMove` decides legality.
   *Why:* the RNGH v3 migration then rewrites one file; a gesture can never double-move (FINAL B.16).
9. **Obey the determinism policy in `packages/game-kit/src/**` and `apps/*/src/{rules,levels,sim,geom}/**`:** only `+ - * /`, `%` and bitwise operators, `Math.sqrt`, `Math.imul`, `Math.floor`, `Math.round`, `Math.abs`, `Math.min`, `Math.max`, `Math.PI`; no `**`, no other `Math.*`, no `Math.random`, no `Date`, no `performance.now`, no `Intl`.
   *Why:* Hermes computes `sin`/`cos`/`exp`/`pow` with the platform libm while Jest runs V8, so replays and daily seeds would diverge; `+ - * /`, `%` and `sqrt` are exactly specified by IEEE 754 / ECMA-262. *Source:* [Hermes MathStdFunctions.def](https://github.com/facebook/hermes/blob/main/lib/VM/JSLib/MathStdFunctions.def), [ECMA-262 Math](https://tc39.es/ecma262/#sec-function-properties-of-the-math-object). *Enforced by:* docs/04 rule 16 (`DETERMINISTIC` block; `Date.now`, `new Date` and `performance.now` are banned in all runtime code; `Intl` in these folders is caught by review).
10. **Take every random number from the seeded integer PRNG (`sfc32`) whose state lives in the game state** (or, for a real-time sim, in the sim's own `Uint32Array`).
    *Why:* same seed ⇒ same level, same daily, same replay on every device (spec 8.3, 8.13).
11. **Mark every UI-thread module with a file-level `'worklet';` directive** (game-kit `rng`, `geom`, `timeline`; each game's `board/draw-*.ts` and `board/layout-*.ts`; `apps/*/src/sim/**`; the Shell's frame runners). A UI-thread module may import values only from other UI-thread modules (and `scheduleOnRN` from `react-native-worklets`); `check-worklet-boundary.test.ts` fails otherwise.
    *Why:* a non-worklet function called on the UI thread crashes at runtime, not at build time. *Source:* [Worklets plugin: workletizing whole files](https://raw.githubusercontent.com/software-mansion/react-native-reanimated/main/docs/docs-worklets/docs/worklets-plugin/about.md).
12. **Talk from the UI thread to JS only with `scheduleOnRN(fn, ...args)`** (never `runOnJS`), and read/write shared values only with `.get()` / `.set()` (never `.value`).
    *Why:* `runOnJS` is deprecated in Worklets 0.10; React Compiler (on, FINAL A.2) requires the accessor methods. *Source:* [scheduleOnRN](https://docs.swmansion.com/react-native-worklets/docs/threading/scheduleOnRN).
13. **Make every frame-callback body a single call into a worklet runner (`runBoardFrame`, `runLoopFrame`) that wraps its work in `try/catch`;** on error it stops the callback and reports through `scheduleOnRN` so the Game screen pauses and calls `errorLog.record('frame-callback', message)` (spec 8.14). `draw()` errors are caught the same way inside `recordBoard`.
    *Why:* an uncaught UI-thread exception kills the app; and React Compiler bails out of memoising a hook whose inline callback has `?.`/ternaries inside `try/catch` (verified), so the body lives outside the hook.
14. **Compute `BoardLayout` as a pure worklet of the actual canvas size** (any aspect: portrait phone, landscape iPad, iOS 27 resizable windows) and use the same layout for drawing and hit-testing. Goldens render every board at three sizes.
    *Why:* draw and touch can never drift; iPad and resizable windows need no special case (FINAL B.18).
15. **Never pixel-flip a board.** Boards are physical; a game that opts in to RTL mirroring (`isMirroredInRtl: true`, e.g. Letter Bugs) mirrors positions in `BoardLayout`, so glyphs stay readable and touches still land.
    *Why:* spec 7.5; `scaleX(-1)` would mirror letters and digits.
16. **Draw Arabic-script words with a Skia `Paragraph` (`textDirection: TextDirection.RTL`), built on JS and cached in `kit.labels`; draw digits and Latin with `drawText`; localise digits in `toView()`.** Measure text with glyph widths, never `SkFont.measureText`.
    *Why:* `drawText` does no shaping; `measureText` is not implemented in Skia's CanvasKit build used by Jest and Node (verified). *Source:* [Skia Paragraph](https://shopify.github.io/react-native-skia/docs/text/paragraph).
17. **Get board fonts from `Skia.FontMgr.System()`** (Vazirmatn is embedded by the `expo-font` config plugin, docs/10); never load fonts at runtime on device. Tests and Node scripts register the TTF explicitly.
    *Why:* verified on the simulator: the system font manager lists `Vazirmatn` once the plugin has embedded it, so the first frame already has the font.
18. **Build paths once with the immutable API (`Skia.PathBuilder.Make()…build()`), at unit size (0…1), and place them with `canvas.save/translate/scale/restore`.** Never call `Skia.Path.Make()` + `addX` in new code.
    *Why:* Skia 2.6 moved to immutable paths; in 2.6.2 the old `SkPath` mutators (`moveTo`, `addCircle`, `transform`…) still work but log a deprecation warning and will be removed. *Source:* [Skia path migration](https://raw.githubusercontent.com/Shopify/react-native-skia/main/apps/docs/docs/shapes/path-migration.md).
19. **Simulate real-time games in fixed steps of `STEP_MS = 1000/120` on the UI thread**, with a 250 ms catch-up clamp, sim state in typed arrays inside one shared value (mutated in place only under `apps/*/src/sim/**`), events batched to JS at most once per frame, and every input quantised to an integer command recorded as `(tick, command)`.
    *Why:* results depend on ticks, never on 60 vs 120 Hz; a recorded run replays bit-exactly in Jest (FINAL B.13).
20. **Set `ios.infoPlist.CADisableMinimumFrameDurationOnPhone = true` (in `withShell`).**
    *Why:* without it iOS caps third-party apps at 60 fps on ProMotion phones. *Source:* [Apple: CADisableMinimumFrameDurationOnPhone](https://developer.apple.com/documentation/bundleresources/information-property-list/cadisableminimumframedurationonphone).
21. **Make reduced motion a parameter of `buildTimeline(events, 'reduced')`:** drop shake and particles, remove overshoot, shorten tweens. The Shell passes `'reduced'` when the Reduce motion setting is on (default: the OS setting).
    *Why:* spec 8.11 and S5; testable as pure data.
22. **Give the board canvas `accessibilityRole="image"` and an `accessibilityLabel` produced by `t()` from `board.describe(view)`.**
    *Why:* Skia content is invisible to VoiceOver (spec 8.11); labels must be translated (N12).
23. **Test every board at three levels:** pure engine and timeline unit tests, a draw-call budget test with a recording canvas, and pixel goldens (`test/goldens/boards/<game>-board.golden.test.ts`, 0.1 % tolerance, docs/07) at t = 0, 50 %, 100 % and three canvas sizes. Assert small text (digits) through the recording canvas, not through pixels.
    *Why:* a two-digit label is ≈ 0.035 % of a phone board, below the golden tolerance (measured).

## 2. Architecture

### 2.1 Layers and data flow

```
 JS thread (pure, testable)                                  UI thread (worklets, 60/120 Hz)
 ─────────────────────────────────────────────────────       ─────────────────────────────────────
 gesture ──InputIntent──► intentToMove(state, intent) ─► Move
                                    │
               GameSession store: applyMove(state, move) → { state, events }; SaveStore write
                                    │  MoveResult { seq, state, events }
                     presentMove(): toView(state) + buildTimeline(events, motion)
                                    │  clock.push(scene)  ─────────────────►  scene (ONE shared value)
                                    │  cues.schedule(tracks) → AudioPort / HapticsPort
                                                                              │ frame callback: runBoardFrame
                                                                              │   stamps startAt, sets now
                                                                              ▼
                                            recordBoard(): sampleTimeline(tracks, now − startAt)
                                                           → draw(canvas, { view, fx, colors, layout, kit })
                                                                              │
                                                                     <Canvas><Picture/></Canvas>
```

Real-time games replace the lower half: `useFixedStepLoop` advances the sim in place every frame and the picture reads the sim directly (section 2.7).

### 2.2 Where the code lives

Canonical layout (FINAL A.8), with the files this doc defines:

```
packages/game-kit/src/                     pure TS, no React/RN/Expo/Skia (docs/04 PURE)
  contract/  game-engine.ts  input-intent.ts            (+ game-module.ts: GameModule, docs/02)
  rng/       sfc32.ts                                     'worklet'
  geom/      board-layout.ts  classify-swipe.ts  vec2.ts  sweep.ts  spatial-hash.ts   'worklet'
  timeline/  track.ts  sample.ts  particles.ts  fixed-step.ts                        'worklet'
  testing/   play-bot.ts
packages/shell/src/game-host/              the Shell side (React Native, Skia, Reanimated, RNGH)
  board-types.ts          GameBoard, DrawFrame, RenderKit, BoardColors, ViewFormat
  board-kit.ts            makeBoardColors, makeBoardKit (Skia API passed in; Node-safe)
  board-scene.ts          BoardScene, makeScene, tickClock ('worklet')
  describe-error.ts  run-board-frame.ts  run-loop-frame.ts  record-board.ts  pan-intent.ts
  draw-centered-text.ts   ('worklet')
  use-board-clock.ts  use-board-gestures.ts  use-fixed-step-loop.ts  use-game-lifecycle.ts
  cue-scheduler.ts  present-move.ts  paint-board-png.ts  sprite-cache.ts (docs/09)
  board-canvas.tsx  game-board-host.tsx  board-gesture-probe.tsx (test host)
packages/shell/src/app/use-is-app-active.ts
packages/tooling/src/quality/check-worklet-boundary.ts (+ .test.ts)
apps/<game-id>/src/
  rules/   <game>-types.ts  apply-move.ts  intent-to-move.ts …    (PURE + DETERMINISTIC)
  board/   board-palettes.json/.ts  to-view.ts  build-timeline.ts  layout-board.ts  draw-board.ts
           <game>-board.ts (GameBoard object) + *.test.ts
  sim/     real-time games only ('worklet', typed arrays mutated in place)
test/goldens/boards/  <game>-board.golden.test.ts + __image_snapshots__/   (needs node:fs, docs/07 rule 7)
```

knip (docs/16) reports every unused export of game-kit and the Shell, so add a kit function together with its first caller or its test.

### 2.3 The engine contract

`GameModule` is defined in `packages/game-kit/src/contract/` (spec section 10; docs/02 section 7 owns the full type). This doc owns its engine members and the board members. Game-kit may not import Skia, so the board members (`draw` needs `SkCanvas`) are typed in the Shell as `GameBoard` and bound by docs/02's `ShellGameModule<T>` as `presentation.board`.

```ts
// packages/game-kit/src/contract/game-engine.ts
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { Motion, Track } from '@e07/game-kit/timeline/track.ts';

/** Result of outcome(): still playing, won with a score, or lost with a catalog reason key. */
export type Outcome =
  | { readonly kind: 'playing' }
  | { readonly kind: 'won'; readonly score: number }
  | { readonly kind: 'lost'; readonly reasonKey: string };

/** applyMove() returns the next state plus the events that explain it (for timeline and sound). */
export type ApplyResult<TState, TEvent> = {
  readonly state: TState;
  readonly events: readonly TEvent[];
};

/**
 * The engine members of GameModule (packages/game-kit/src/contract). All pure, all on
 * the JS thread, all obeying the determinism policy. Names are canonical (FINAL-DECISIONS F).
 */
export type GameEngine<TState, TMove, TEvent> = {
  readonly create: (seed: number, difficulty: number) => TState;
  readonly listMoves: (state: TState) => readonly TMove[];
  readonly applyMove: (state: TState, move: TMove) => ApplyResult<TState, TEvent>;
  readonly outcome: (state: TState) => Outcome;
  readonly intentToMove: (state: TState, intent: InputIntent) => TMove | null;
  readonly buildTimeline: (events: readonly TEvent[], motion: Motion) => readonly Track[];
};
```

```ts
// packages/game-kit/src/contract/input-intent.ts
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type { SwipeDirection } from '@e07/game-kit/geom/classify-swipe.ts';

/**
 * What the player did, in board terms. Produced on the UI thread by useBoardGestures,
 * delivered to JS with scheduleOnRN, turned into a Move by the game's intentToMove().
 */
export type InputIntent =
  | { readonly kind: 'tap'; readonly target: BoardTarget }
  | { readonly kind: 'long-press'; readonly target: BoardTarget }
  | {
      readonly kind: 'swipe';
      readonly direction: SwipeDirection;
      readonly from: BoardTarget | null;
    }
  | { readonly kind: 'drag-end'; readonly from: BoardTarget; readonly to: BoardTarget | null }
  /** Release vector of an aim drag, in canvas points (Bank Shot). */
  | { readonly kind: 'aim'; readonly dx: number; readonly dy: number };
```

```ts
// packages/shell/src/game-host/board-types.ts
import type { BoardLayout, BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type { FxSample } from '@e07/game-kit/timeline/sample.ts';
import type {
  SkCanvas,
  SkColor,
  SkFont,
  SkPaint,
  SkParagraph,
  SkPath,
  Skia,
} from '@shopify/react-native-skia';

/** Finger state on the UI thread (drag ghosts, hover highlights). Never goes through React. */
export type PointerSample = {
  readonly isDown: boolean;
  readonly x: number;
  readonly y: number;
  readonly hover: BoardTarget | null;
  readonly dragFrom: BoardTarget | null;
};

/** The Skia API object (device module, Jest CanvasKit mock, or headless getSkiaExports().Skia). */
export type SkiaApi = typeof Skia;

export const IDLE_POINTER: PointerSample = {
  isDown: false,
  x: 0,
  y: 0,
  hover: null,
  dragFrom: null,
};

/** Everything that changes per frame on the UI thread: the timeline sample plus the pointer. */
export type BoardFx = FxSample & { readonly pointer: PointerSample };

/** Palette tokens resolved to Skia colours once per theme (light/dark/colour-blind). */
export type BoardColors<TToken extends string> = {
  readonly scheme: 'light' | 'dark';
  readonly isColorBlind: boolean;
  readonly color: Readonly<Record<TToken, SkColor>>;
};

/** Skia objects built once on the JS thread and reused every frame (no per-frame allocation). */
export type RenderKit = {
  /** Scratch fill paint: set colour/alpha immediately before each draw call. */
  readonly fill: SkPaint;
  /** Scratch stroke paint. */
  readonly stroke: SkPaint;
  /** Bundled font for digits and Latin via drawText (no shaping needed). */
  readonly numberFont: SkFont | null;
  /** Unit-size (0…1) paths, drawn with canvas.scale/translate. */
  readonly paths: Readonly<Partial<Record<string, SkPath>>>;
  /** Shaped, laid-out paragraphs for Arabic-script or multi-word text. */
  readonly labels: Readonly<Partial<Record<string, SkParagraph>>>;
};

/** The five inputs of draw(), grouped to respect max-params 3. */
export type DrawFrame<TView, TToken extends string> = {
  readonly view: TView;
  readonly fx: BoardFx;
  readonly colors: BoardColors<TToken>;
  readonly layout: BoardLayout;
  readonly kit: RenderKit;
};

export type LayoutInput<TView> = {
  readonly width: number;
  readonly height: number;
  readonly view: TView;
  readonly isMirrored: boolean;
};

/** Digit and number formatting from the Shell's i18n (docs on i18n), applied in toView. */
export type ViewFormat = { readonly formatNumber: (value: number) => string };

/** A catalog message id plus values; the Shell renders it with t() for the canvas a11y label. */
export type A11yMessage = {
  readonly id: string;
  readonly values: Readonly<Record<string, number | string>>;
};

/** The rendering members a game module provides (apps/<game>/src/board). */
export type GameBoard<TState, TView, TToken extends string> = {
  /** Spec 10 "declares whether the board mirrors in RTL" (default false). */
  readonly isMirroredInRtl: boolean;
  /** JS thread, pure: state → flat, serialisable view with digits already localised. */
  readonly toView: (state: TState, format: ViewFormat) => TView;
  /** Worklet: canvas size → layout. Used by draw AND hit-testing. */
  readonly layout: (input: LayoutInput<TView>) => BoardLayout;
  /** Worklet: paints one frame. Must not allocate Skia objects or read clocks. */
  readonly draw: (canvas: SkCanvas, frame: DrawFrame<TView, TToken>) => void;
  /** JS thread: build unit paths once per kit (Skia.PathBuilder). */
  readonly buildPaths: (skia: SkiaApi) => Readonly<Partial<Record<string, SkPath>>>;
  /** Spoken summary for VoiceOver (spec 8.11). */
  readonly describe: (view: TView) => A11yMessage;
};
```

`DrawFrame` groups FINAL B.12's `draw(canvas, view, fx, colors, layout)` inputs into one object (docs/04 allows three parameters) and adds `kit`, the pre-built Skia objects.

### 2.4 The timeline

`buildTimeline` turns events into `Track`s: pure data that says "entity 3's `row` channel goes from 1 to 2 between 420 ms and 640 ms, easing in-out, and when it starts, play `hit` and a medium haptic". The view pushed with the tracks is always the **final** state; tracks describe how the board gets there. Anything that disappears (a dead monster) must be drawable from its tracks alone.

```ts
// packages/game-kit/src/timeline/track.ts
'worklet';

/** Easing names; implemented with polynomials only (see ease()). */
export type EasingId = 'linear' | 'in-quad' | 'out-quad' | 'in-out-quad' | 'out-cubic' | 'out-back';

/** Haptic vocabulary shared by games and the Shell's HapticsPort (docs/09-sound-haptics-art.md). */
export type HapticCue =
  'selection' | 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

/** Fired once when the track starts. `sound` is an id from the game's sound set. */
export type TrackCue = { readonly sound?: string; readonly haptic?: HapticCue };

/**
 * One animated property of one entity. `from`/`to` are equal-length number vectors
 * (x/y, alpha, a colour index…); the sampler interpolates them component by component.
 */
export type Track = {
  readonly channel: string;
  readonly entityId: number;
  readonly startMs: number;
  readonly durationMs: number;
  readonly easing: EasingId;
  readonly from: readonly number[];
  readonly to: readonly number[];
  readonly cue?: TrackCue;
};

/** 'reduced' when Reduce motion is on: no shake, no particles, shorter tweens. */
export type Motion = 'full' | 'reduced';

/** Polynomial easings only: exact +, -, * keep them inside the determinism policy. */
export function ease(easing: EasingId, p: number): number {
  switch (easing) {
    case 'linear':
      return p;
    case 'in-quad':
      return p * p;
    case 'out-quad':
      return p * (2 - p);
    case 'in-out-quad':
      return p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
    case 'out-cubic': {
      const q = p - 1;
      return q * q * q + 1;
    }
    case 'out-back': {
      const q = p - 1;
      return q * q * (2.70158 * q + 1.70158) + 1;
    }
  }
}

/** When the last track ends: the scene is "done" at this elapsed time. */
export function timelineEndMs(tracks: readonly Track[]): number {
  let end = 0;
  for (const track of tracks) {
    end = Math.max(end, track.startMs + track.durationMs);
  }
  return end;
}
```

```ts
// packages/game-kit/src/timeline/sample.ts
'worklet';

import { ease } from './track.ts';

import type { Track } from './track.ts';

/** The sampled state of one (channel, entity) pair at a moment of the timeline. */
export type FxEntry = {
  readonly values: readonly number[];
  /** Eased progress 0…1 of the active track. */
  readonly progress: number;
  /** Milliseconds since the active track started, clamped to 0…durationMs. */
  readonly ageMs: number;
};

/** Every animated key of a scene at one elapsed time. */
export type FxSample = {
  readonly elapsedMs: number;
  readonly entries: Readonly<Partial<Record<string, FxEntry>>>;
};

/** No animation: draw() shows the view's final state. */
export const EMPTY_FX: FxSample = { elapsedMs: 0, entries: {} };

/** Stable key for a (channel, entity) pair, e.g. 'beam:3'. */
export function trackKey(channel: string, entityId: number): string {
  return `${channel}:${String(entityId)}`;
}

/** Interpolates one track at an elapsed time (clamped to its start and end). */
export function sampleTrack(track: Track, elapsedMs: number): FxEntry {
  const ageMs = Math.min(Math.max(elapsedMs - track.startMs, 0), track.durationMs);
  const linear = track.durationMs > 0 ? ageMs / track.durationMs : 1;
  const progress = ease(track.easing, linear);
  const values: number[] = [];
  for (let i = 0; i < track.from.length; i += 1) {
    const from = track.from[i] ?? 0;
    const to = track.to[i] ?? from;
    values.push(from + (to - from) * progress);
  }
  return { values, progress, ageMs };
}

/** Started tracks beat unstarted ones; the latest started wins; else the earliest unstarted. */
function isBetterTrack(
  candidateStart: number,
  currentStart: number | undefined,
  t: number,
): boolean {
  if (currentStart === undefined) return true;
  const isCandidateStarted = candidateStart <= t;
  const isCurrentStarted = currentStart <= t;
  if (isCandidateStarted !== isCurrentStarted) return isCandidateStarted;
  return isCandidateStarted ? candidateStart >= currentStart : candidateStart < currentStart;
}

/**
 * Samples every key once. Before any track of a key starts, the key holds that
 * track's `from` (so a monster waits in its old cell until its move begins).
 */
export function sampleTimeline(tracks: readonly Track[], elapsedMs: number): FxSample {
  const entries: Partial<Record<string, FxEntry>> = {};
  const activeStart: Partial<Record<string, number>> = {};
  for (const track of tracks) {
    const key = trackKey(track.channel, track.entityId);
    if (isBetterTrack(track.startMs, activeStart[key], elapsedMs)) {
      activeStart[key] = track.startMs;
      entries[key] = sampleTrack(track, elapsedMs);
    }
  }
  return { elapsedMs, entries };
}

/** Reads one sampled entry; `undefined` means "no track: draw the view's final state". */
export function fxEntry(fx: FxSample, channel: string, entityId: number): FxEntry | undefined {
  return fx.entries[trackKey(channel, entityId)];
}
```

A game's builder (Line Siege shown; the reduced-motion branch is part of the contract):

```ts
// apps/line-siege/src/board/build-timeline.ts
import type { Motion, Track } from '@e07/game-kit/timeline/track.ts';
import type { LineSiegeEvent } from '@e07/line-siege/rules/line-siege-types.ts';

const BEAM_AT_MS = 120;
const HIT_AT_MS = 320;
const MARCH_AT_MS = 420;

/** Reduced motion: half durations, no particles, no overshoot. */
type Timing = { readonly scale: number; readonly isFull: boolean };

type EventOf<TKind extends LineSiegeEvent['kind']> = Extract<LineSiegeEvent, { kind: TKind }>;

function placed(event: EventOf<'placed'>, timing: Timing): Track[] {
  return [
    {
      channel: 'pop',
      entityId: event.row * 100 + event.col,
      startMs: 0,
      durationMs: 140 * timing.scale,
      easing: timing.isFull ? 'out-back' : 'linear',
      from: [0.6],
      to: [1],
      cue: { sound: 'place', haptic: 'light' },
    },
  ];
}

function cleared(event: EventOf<'column-cleared'>, timing: Timing): Track[] {
  const at = { entityId: event.col, startMs: BEAM_AT_MS * timing.scale } as const;
  const beam: Track = {
    ...at,
    channel: 'beam',
    durationMs: 260 * timing.scale,
    easing: 'out-quad',
    from: [0],
    to: [1],
    cue: { sound: 'beam', haptic: 'medium' },
  };
  const burst: Track = {
    ...at,
    channel: 'burst',
    durationMs: 600,
    easing: 'linear',
    from: [0],
    to: [1],
  };
  return timing.isFull ? [beam, burst] : [beam];
}

function monsterHit(event: EventOf<'monster-hit'>, timing: Timing): Track[] {
  const startMs = HIT_AT_MS * timing.scale;
  const durationMs = 180 * timing.scale;
  const flash = { channel: 'flash', entityId: event.monsterId, startMs, durationMs } as const;
  return [{ ...flash, easing: 'linear', from: [1], to: [0], cue: { sound: 'hit' } }];
}

function monsterMoved(event: EventOf<'monster-moved'>, timing: Timing): Track[] {
  const startMs = MARCH_AT_MS * timing.scale;
  const durationMs = 220 * timing.scale;
  const march = { channel: 'row', entityId: event.monsterId, startMs, durationMs } as const;
  return [{ ...march, easing: 'in-out-quad', from: [event.fromRow], to: [event.toRow] }];
}

function tracksFor(event: LineSiegeEvent, timing: Timing): Track[] {
  switch (event.kind) {
    case 'placed':
      return placed(event, timing);
    case 'column-cleared':
      return cleared(event, timing);
    case 'monster-hit':
      return monsterHit(event, timing);
    case 'monster-moved':
      return monsterMoved(event, timing);
  }
}

/** Pure: events → tracks. The same events always give the same tracks. */
export function buildTimeline(events: readonly LineSiegeEvent[], motion: Motion): readonly Track[] {
  const timing = { scale: motion === 'full' ? 1 : 0.5, isFull: motion === 'full' };
  return events.flatMap((event) => tracksFor(event, timing));
}
```

### 2.5 The frame clock (with the verified `startAt` fix)

The bug in the first design: the clock wrote `now = f.timeSinceFirstFrame`, JS computed `t0 = now`, and the callback was stopped when idle. Reanimated sets `startTime = null` whenever a callback is deactivated, so after a restart `timeSinceFirstFrame` begins at 0 again while `t0` still held the old value: every animation after the first started with a negative elapsed time and froze. Using `f.timestamp` alone is also wrong (a stopped clock leaves `now` stale). The fix is the sentinel:

```ts
// packages/shell/src/game-host/board-scene.ts
'worklet';

import { timelineEndMs } from '@e07/game-kit/timeline/track.ts';

import type { Track } from '@e07/game-kit/timeline/track.ts';

/** Sentinel written by JS; the first frame callback after a push replaces it with f.timestamp. */
export const NOT_STARTED = -1;

/**
 * Everything the board needs for one move, pushed as ONE shared value so the UI
 * thread can never pair a new view with old tracks (or the reverse).
 */
export type BoardScene<TView> = {
  readonly seq: number;
  readonly view: TView;
  readonly tracks: readonly Track[];
  readonly endMs: number;
  readonly startAt: number;
};

export function makeScene<TView>(
  seq: number,
  view: TView,
  tracks: readonly Track[],
): BoardScene<TView> {
  return { seq, view, tracks, endMs: timelineEndMs(tracks), startAt: NOT_STARTED };
}

export type ClockTick = {
  readonly startAt: number;
  readonly elapsedMs: number;
  readonly isDone: boolean;
};

/**
 * Called with FrameInfo.timestamp. Never uses timeSinceFirstFrame: Reanimated resets it
 * to 0 each time a frame callback is re-activated, which froze every animation after the
 * first one in the original wiring (verified in FrameCallbackRegistryUI.ts, Reanimated 4.5.1).
 */
export function tickClock(
  scene: Pick<BoardScene<unknown>, 'startAt' | 'endMs'>,
  timestamp: number,
): ClockTick {
  const startAt = scene.startAt === NOT_STARTED ? timestamp : scene.startAt;
  const elapsedMs = Math.max(0, timestamp - startAt);
  return { startAt, elapsedMs, isDone: elapsedMs >= scene.endMs };
}

/** Elapsed time for drawing. A just-pushed scene draws its first frame (t = 0). */
export function sceneElapsedMs(
  scene: Pick<BoardScene<unknown>, 'startAt'>,
  nowTimestamp: number,
): number {
  return scene.startAt === NOT_STARTED ? 0 : Math.max(0, nowTimestamp - scene.startAt);
}

/** JS side: is the last pushed scene still playing? (Input policy 'queue' waits for false.) */
export function isSceneAnimating(
  scene: Pick<BoardScene<unknown>, 'startAt' | 'endMs'>,
  nowTimestamp: number,
): boolean {
  return sceneElapsedMs(scene, nowTimestamp) < scene.endMs;
}
```

```ts
// packages/shell/src/game-host/describe-error.ts
'worklet';

/** Error → short text for ErrorLogPort; safe on both runtimes (JS and UI). */
export function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
```

```ts
// packages/shell/src/game-host/run-board-frame.ts
'worklet';

import { scheduleOnRN } from 'react-native-worklets';

import { NOT_STARTED, tickClock } from './board-scene.ts';
import { describeError } from './describe-error.ts';

import type { BoardScene } from './board-scene.ts';
import type { SharedValue } from 'react-native-reanimated';

/**
 * The whole body of the turn-based board clock's frame callback. Kept out of the hook:
 * one worklet call per frame, try/catch in one place, and React Compiler still memoises
 * the hook (it bails out on value blocks such as ?. or ternaries inside try/catch).
 */
export type BoardFrameWiring<TView> = {
  readonly scene: SharedValue<BoardScene<TView>>;
  readonly now: SharedValue<number>;
  readonly onDone: (seq: number) => void;
  readonly onError: (message: string) => void;
};

export function runBoardFrame<TView>(wiring: BoardFrameWiring<TView>, timestamp: number): void {
  try {
    const current = wiring.scene.get();
    const tick = tickClock(current, timestamp);
    if (current.startAt === NOT_STARTED) wiring.scene.set({ ...current, startAt: tick.startAt });
    wiring.now.set(timestamp);
    if (tick.isDone) scheduleOnRN(wiring.onDone, current.seq);
  } catch (error) {
    scheduleOnRN(wiring.onError, describeError(error));
  }
}
```

```ts
// packages/shell/src/game-host/use-board-clock.ts
import { useEffect, useRef } from 'react';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';

import { runBoardFrame } from './run-board-frame.ts';

import type { BoardScene } from './board-scene.ts';
import type { FrameCallback, SharedValue } from 'react-native-reanimated';

export type BoardClock<TView> = {
  readonly scene: SharedValue<BoardScene<TView>>;
  /** Latest FrameInfo.timestamp seen by the clock; the picture reads it to re-record. */
  readonly now: SharedValue<number>;
  /** JS: show a new scene and run the clock until its timeline ends. */
  readonly push: (next: BoardScene<TView>) => void;
  /** JS: stop the clock (pause, background, ad, blur). */
  readonly stop: () => void;
  /** JS: restart after stop(); an interrupted timeline jumps to its end state. */
  readonly resume: () => void;
};

export function useBoardClock<TView>(
  initial: BoardScene<TView>,
  onError: (message: string) => void,
): BoardClock<TView> {
  const scene = useSharedValue(initial);
  const now = useSharedValue(0);
  // Breaks the cycle "frame callback → JS handler → frame.setActive" without TDZ access.
  const frameRef = useRef<FrameCallback | null>(null);
  const onDone = (seq: number): void => {
    // A newer scene may have been pushed while this message was in flight: keep running.
    if (seq === scene.get().seq) frameRef.current?.setActive(false);
  };
  const handleError = (message: string): void => {
    frameRef.current?.setActive(false);
    onError(message);
  };
  const wiring = { scene, now, onDone, onError: handleError };
  const frame = useFrameCallback((info) => {
    runBoardFrame(wiring, info.timestamp);
  }, false);
  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);
  return {
    scene,
    now,
    push: (next) => {
      scene.set(next);
      frame.setActive(true);
    },
    stop: () => {
      frame.setActive(false);
    },
    resume: () => {
      frame.setActive(true);
    },
  };
}
```

Two details that matter:

- **The ref.** `onDone` must call `frame.setActive(false)`, but `frame` is created by `useFrameCallback` from a callback that references `onDone`. Referencing `frame` directly is a TDZ access (`react-hooks/immutability` error); the ref assigned in an effect breaks the cycle.
- **The seq check.** A "done" message for scene 7 can arrive after JS already pushed scene 8. `onDone` compares `seq` so it never stops a newer animation.

Verified on the iOS 26.5 simulator (Release): 8 consecutive scenes, each stopped and restarted, all started at elapsed 0; the last one logged `endMs=720 elapsedAtLastFrame=733 frames=45` (one frame past the end, then the clock stopped itself).

The debug frame-time recorder (docs/15) never owns a frame callback: in test builds, add `sampleFrame(histogram, isRecording, frameInfo.timeSincePreviousFrame)` as the first statement inside the `try` of `runBoardFrame` and `runLoopFrame`, passing the two shared values through the wiring object.

### 2.6 The renderer

`board-kit.ts` receives the Skia API as a parameter so it runs on device, in Jest (CanvasKit mock) and in Node (headless CanvasKit):

```ts
// packages/shell/src/game-host/board-kit.ts
// Imports Skia TYPES only and receives the Skia API as a parameter, so the same code runs
// on device (Skia from the package), in Jest goldens (CanvasKit mock) and in Node art
// scripts (getSkiaExports() from the headless build).
import type { BoardColors, RenderKit, SkiaApi } from './board-types.ts';
import type { SkColor, SkPath, SkTypeface } from '@shopify/react-native-skia';

/** Hex colours per semantic token, one set per scheme (see docs/09-sound-haptics-art.md). */
export type BoardPalette<TToken extends string> = Readonly<Record<TToken, string>>;

export type PaletteSet<TToken extends string> = {
  readonly light: BoardPalette<TToken>;
  readonly dark: BoardPalette<TToken>;
  readonly colorBlindLight: BoardPalette<TToken>;
  readonly colorBlindDark: BoardPalette<TToken>;
};

export type ColorChoice = { readonly scheme: 'light' | 'dark'; readonly isColorBlind: boolean };

/** PaintStyle.Stroke; a literal so this module needs no value import from Skia. */
const PAINT_STYLE_STROKE = 1;

export function pickPalette<TToken extends string>(
  set: PaletteSet<TToken>,
  choice: ColorChoice,
): BoardPalette<TToken> {
  if (choice.isColorBlind)
    return choice.scheme === 'dark' ? set.colorBlindDark : set.colorBlindLight;
  return choice.scheme === 'dark' ? set.dark : set.light;
}

/** Resolves every token once per theme change; draw() then reads `colors.color.<token>`. */
export function makeBoardColors<TToken extends string>(
  skia: SkiaApi,
  set: PaletteSet<TToken>,
  choice: ColorChoice,
): BoardColors<TToken> {
  const palette: Readonly<Record<string, string>> = pickPalette(set, choice);
  const color = Object.fromEntries(
    Object.entries(palette).map(([token, hex]): [string, SkColor] => [token, skia.Color(hex)]),
  ) as Record<TToken, SkColor>;
  return { scheme: choice.scheme, isColorBlind: choice.isColorBlind, color };
}

export type KitInput = {
  readonly paths: Readonly<Partial<Record<string, SkPath>>>;
  readonly numberTypeface: SkTypeface | null;
  readonly numberSize: number;
};

export function makeBoardKit(skia: SkiaApi, input: KitInput): RenderKit {
  const fill = skia.Paint();
  fill.setAntiAlias(true);
  const stroke = skia.Paint();
  stroke.setAntiAlias(true);
  stroke.setStyle(PAINT_STYLE_STROKE);
  const numberFont =
    input.numberTypeface === null ? null : skia.Font(input.numberTypeface, input.numberSize);
  return { fill, stroke, numberFont, paths: input.paths, labels: {} };
}
```

```ts
// packages/shell/src/game-host/record-board.ts
'worklet';

import { sampleTimeline } from '@e07/game-kit/timeline/sample.ts';

import { sceneElapsedMs } from './board-scene.ts';
import { describeError } from './describe-error.ts';

import type { BoardScene } from './board-scene.ts';
import type { BoardColors, DrawFrame, PointerSample, RenderKit } from './board-types.ts';
import type { BoardLayout } from '@e07/game-kit/geom/board-layout.ts';
import type { SkCanvas, SkPicture, SkPictureRecorder } from '@shopify/react-native-skia';

export type RecordInput<TView, TToken extends string> = {
  readonly scene: BoardScene<TView>;
  readonly now: number;
  readonly layout: BoardLayout;
  readonly pointer: PointerSample;
  readonly colors: BoardColors<TToken>;
  readonly kit: RenderKit;
  readonly draw: (canvas: SkCanvas, frame: DrawFrame<TView, TToken>) => void;
  /** Must itself be a worklet (it runs on the UI thread); it forwards with scheduleOnRN. */
  readonly onError: (message: string) => void;
};

/**
 * Records one frame into a Picture. Runs inside useDerivedValue on the UI thread.
 * A draw() exception must not crash the app: report it and return an empty picture.
 */
export function recordBoard<TView, TToken extends string>(
  recorder: SkPictureRecorder,
  input: RecordInput<TView, TToken>,
): SkPicture {
  const canvas = recorder.beginRecording({
    x: 0,
    y: 0,
    width: input.layout.width,
    height: input.layout.height,
  });
  try {
    const timeline = sampleTimeline(input.scene.tracks, sceneElapsedMs(input.scene, input.now));
    input.draw(canvas, {
      view: input.scene.view,
      fx: { ...timeline, pointer: input.pointer },
      colors: input.colors,
      layout: input.layout,
      kit: input.kit,
    });
  } catch (error) {
    input.onError(describeError(error));
  }
  return recorder.finishRecordingAsPicture();
}
```

```tsx
// packages/shell/src/game-host/board-canvas.tsx
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { EMPTY_LAYOUT } from '@e07/game-kit/geom/board-layout.ts';

import { recordBoard } from './record-board.ts';
import { useBoardGestures } from './use-board-gestures.ts';

import type { BoardColors, GameBoard, RenderKit } from './board-types.ts';
import type { PanMode } from './pan-intent.ts';
import type { BoardClock } from './use-board-clock.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type { SkSize } from '@shopify/react-native-skia';

export type BoardCanvasProps<TState, TView, TToken extends string> = {
  readonly board: GameBoard<TState, TView, TToken>;
  readonly clock: BoardClock<TView>;
  readonly colors: BoardColors<TToken>;
  readonly kit: RenderKit;
  readonly isRtl: boolean;
  readonly panMode: PanMode;
  /** Already translated with t() from board.describe(view). */
  readonly accessibilityLabel: string;
  readonly onIntent: (intent: InputIntent) => void;
  readonly onHover: (target: BoardTarget | null) => void;
  readonly onDrawError: (message: string) => void;
};

export function BoardCanvas<TState, TView, TToken extends string>(
  props: BoardCanvasProps<TState, TView, TToken>,
): React.JSX.Element {
  const { board, clock, colors, kit, onDrawError } = props;
  // One recorder per canvas, reused every frame; created in render, not at import (docs/04 rule 17).
  const [recorder] = useState(() => Skia.PictureRecorder());
  const isMirrored = props.isRtl && board.isMirroredInRtl;
  const size = useSharedValue<SkSize>({ width: 0, height: 0 });

  const layout = useDerivedValue(() => {
    const { width, height } = size.get();
    return width === 0
      ? EMPTY_LAYOUT
      : board.layout({ width, height, view: clock.scene.get().view, isMirrored });
  });
  const { gesture, pointer } = useBoardGestures(layout, {
    panMode: props.panMode,
    onIntent: props.onIntent,
    onHover: props.onHover,
  });
  const reportDrawError = (message: string): void => {
    'worklet';
    scheduleOnRN(onDrawError, message);
  };
  const picture = useDerivedValue(() =>
    recordBoard(recorder, {
      scene: clock.scene.get(),
      now: clock.now.get(),
      layout: layout.get(),
      pointer: pointer.get(),
      colors,
      kit,
      draw: board.draw,
      onError: reportDrawError,
    }),
  );

  return (
    <GestureDetector gesture={gesture}>
      <Canvas
        style={styles.canvas}
        onSize={size}
        opaque
        accessible
        accessibilityRole="image"
        accessibilityLabel={props.accessibilityLabel}
      >
        <Picture picture={picture} />
      </Canvas>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
});
```

The board area of S5 composes clock, presenter, cues and lifecycle:

```ts
// packages/shell/src/game-host/present-move.ts

import { makeScene } from './board-scene.ts';

import type { CueScheduler } from './cue-scheduler.ts';
import type { BoardClock } from './use-board-clock.ts';
import type { Motion, Track } from '@e07/game-kit/timeline/track.ts';

export type PresenterDeps<TState, TEvent, TView> = {
  /** board.toView with the Shell's ViewFormat already applied. */
  readonly toView: (state: TState) => TView;
  /** The game's buildTimeline (GameModule). */
  readonly buildTimeline: (events: readonly TEvent[], motion: Motion) => readonly Track[];
  /** 'reduced' when the Reduce motion setting is on (defaults to the OS setting). */
  readonly motion: Motion;
  readonly clock: Pick<BoardClock<TView>, 'push'>;
  readonly cues: CueScheduler;
};

/** What the GameSession store publishes after it applied AND saved a move. */
export type MoveResult<TState, TEvent> = {
  /** Move counter from the session: becomes the scene's seq. */
  readonly seq: number;
  readonly state: TState;
  readonly events: readonly TEvent[];
};

/**
 * Shows one committed move. The view is always the final state, so a new move simply
 * replaces a running animation (fast-forward); its unfired cues are cancelled first.
 */
export function presentMove<TState, TEvent, TView>(
  deps: PresenterDeps<TState, TEvent, TView>,
  result: MoveResult<TState, TEvent>,
): void {
  deps.cues.cancel();
  const tracks = deps.buildTimeline(result.events, deps.motion);
  deps.clock.push(makeScene(result.seq, deps.toView(result.state), tracks));
  deps.cues.schedule(tracks);
}
```

```ts
// packages/shell/src/game-host/cue-scheduler.ts
import type { Track } from '@e07/game-kit/timeline/track.ts';
import type { AudioPort } from '@e07/shell/services/audio/audio-port.ts';
import type { HapticsPort } from '@e07/shell/services/haptics/haptics-port.ts';

export type CueScheduler = {
  /** Fires every track cue at the track's start: sounds on the audio clock, haptics via timers. */
  readonly schedule: (tracks: readonly Track[]) => void;
  /** Drops everything not yet fired (fast-forward, pause, leaving the screen). */
  readonly cancel: () => void;
};

export function createCueScheduler(audio: AudioPort, haptics: HapticsPort): CueScheduler {
  let timers: ReturnType<typeof setTimeout>[] = [];
  const cancel = (): void => {
    for (const timer of timers) clearTimeout(timer);
    timers = [];
    audio.cancelPending();
  };
  const schedule = (tracks: readonly Track[]): void => {
    for (const { cue, startMs } of tracks) {
      if (cue?.sound !== undefined) audio.play(cue.sound, startMs);
      const haptic = cue?.haptic;
      if (haptic === undefined) continue;
      if (startMs <= 0) haptics.play(haptic);
      else
        timers.push(
          setTimeout(() => {
            haptics.play(haptic);
          }, startMs),
        );
    }
  };
  return { schedule, cancel };
}
```

```tsx
// packages/shell/src/game-host/game-board-host.tsx
import { useEffect, useEffectEvent, useState } from 'react';

import { BoardCanvas } from './board-canvas.tsx';
import { makeScene } from './board-scene.ts';
import { createCueScheduler } from './cue-scheduler.ts';
import { presentMove } from './present-move.ts';
import { useBoardClock } from './use-board-clock.ts';
import { useGameLifecycle } from './use-game-lifecycle.ts';

import type { BoardColors, GameBoard, RenderKit, ViewFormat } from './board-types.ts';
import type { PanMode } from './pan-intent.ts';
import type { MoveResult } from './present-move.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type { Motion, Track } from '@e07/game-kit/timeline/track.ts';
import type { AudioPort } from '@e07/shell/services/audio/audio-port.ts';
import type { HapticsPort } from '@e07/shell/services/haptics/haptics-port.ts';

export type GameBoardHostProps<TState, TEvent, TView, TToken extends string> = {
  readonly board: GameBoard<TState, TView, TToken>;
  readonly buildTimeline: (events: readonly TEvent[], motion: Motion) => readonly Track[];
  /** Latest committed move from the GameSession store (already saved). */
  readonly result: MoveResult<TState, TEvent>;
  readonly format: ViewFormat;
  readonly motion: Motion;
  readonly colors: BoardColors<TToken>;
  readonly kit: RenderKit;
  readonly isRtl: boolean;
  readonly panMode: PanMode;
  readonly accessibilityLabel: string;
  readonly audio: AudioPort;
  readonly haptics: HapticsPort;
  readonly isFocused: boolean;
  readonly isFullscreenAdShowing: boolean;
  readonly onIntent: (intent: InputIntent) => void;
  readonly onHover: (target: BoardTarget | null) => void;
  /** Pause the game and write the local error log (spec 8.14). */
  readonly onFailure: (message: string) => void;
  /** `(error) => errorLog.record('audio', error)` for non-fatal audio session failures. */
  readonly reportError: (error: unknown) => void;
};

/** Board area of S5: clock + presenter + cues + lifecycle around one BoardCanvas. */
export function GameBoardHost<TState, TEvent, TView, TToken extends string>(
  props: GameBoardHostProps<TState, TEvent, TView, TToken>,
): React.JSX.Element {
  const { board, result, format, audio, haptics } = props;
  const toView = (state: TState): TView => board.toView(state, format);
  const clock = useBoardClock(makeScene(result.seq, toView(result.state), []), props.onFailure);
  const [cues] = useState(() => createCueScheduler(audio, haptics));
  const present = useEffectEvent((next: MoveResult<TState, TEvent>) => {
    const deps = { toView, buildTimeline: props.buildTimeline, motion: props.motion, clock, cues };
    presentMove(deps, next);
  });
  useEffect(() => {
    present(result);
  }, [result]);
  useGameLifecycle({
    isFocused: props.isFocused,
    isFullscreenAdShowing: props.isFullscreenAdShowing,
    onPause: () => {
      clock.stop();
      cues.cancel();
      audio.suspend().catch(props.reportError);
    },
    onResume: () => {
      audio.resume().catch(props.reportError);
      clock.resume();
    },
  });
  return (
    <BoardCanvas
      board={board}
      clock={clock}
      colors={props.colors}
      kit={props.kit}
      isRtl={props.isRtl}
      panMode={props.panMode}
      accessibilityLabel={props.accessibilityLabel}
      onIntent={props.onIntent}
      onHover={props.onHover}
      onDrawError={props.onFailure}
    />
  );
}
```

The Game screen (`screens/game/`, docs/06 section 3.5 for its navigation) owns the session store, `t()`, settings and ports; it passes `result` (the session's latest `MoveResult`), `onIntent = (intent) => { const move = game.intentToMove(state, intent); if (move !== null) session.dispatch({ type: 'apply-move', move }); }`, the translated label, and the ports from `useServices()`.

A game's draw function (Line Siege). Plain `{ x, y, width, height }` objects are accepted wherever Skia wants an `SkRect`, on device and in CanvasKit (verified), so drawing allocates no Skia objects:

```ts
// apps/line-siege/src/board/draw-board.ts
'worklet';

import { cellRect } from '@e07/game-kit/geom/board-layout.ts';
import { sampleParticle } from '@e07/game-kit/timeline/particles.ts';
import { fxEntry } from '@e07/game-kit/timeline/sample.ts';
import { drawCenteredText } from '@e07/shell/game-host/draw-centered-text.ts';

import type { BoardToken } from './board-palettes.ts';
import type { LineSiegeView } from './to-view.ts';
import type { DrawFrame } from '@e07/shell/game-host/board-types.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

type Frame = DrawFrame<LineSiegeView, BoardToken>;

const CORNER = 0.14;
const INSET = 0.06;
const BURST_COUNT = 18;

function drawCells(canvas: SkCanvas, frame: Frame): void {
  const { view, layout, colors, kit, fx } = frame;
  for (let i = 0; i < view.cells.length; i += 1) {
    const rect = cellRect(layout, {
      regionId: 'board',
      col: i % view.cols,
      row: Math.floor(i / view.cols),
    });
    if (rect === null) continue;
    const isFilled = view.cells[i] === 1;
    const pop = isFilled
      ? (fxEntry(fx, 'pop', Math.floor(i / view.cols) * 100 + (i % view.cols))?.values[0] ?? 1)
      : 1;
    const inset = rect.width * (INSET + (1 - pop) / 2);
    kit.fill.setColor(isFilled ? colors.color.block : colors.color.cell);
    const inner = {
      x: rect.x + inset,
      y: rect.y + inset,
      width: rect.width - 2 * inset,
      height: rect.height - 2 * inset,
    };
    canvas.drawRRect({ rect: inner, rx: rect.width * CORNER, ry: rect.width * CORNER }, kit.fill);
  }
}

function drawBeams(canvas: SkCanvas, frame: Frame): void {
  const { view, layout, colors, kit, fx } = frame;
  for (let col = 0; col < view.cols; col += 1) {
    const beam = fxEntry(fx, 'beam', col);
    const top = cellRect(layout, { regionId: 'board', col, row: 0 });
    if (beam === undefined || top === null || beam.progress >= 1) continue;
    const height = top.height * view.rows * beam.progress;
    kit.fill.setColor(colors.color.beam);
    kit.fill.setAlphaf(1 - beam.progress * 0.5);
    canvas.drawRect(
      {
        x: top.x + top.width * 0.3,
        y: top.y + top.height * view.rows - height,
        width: top.width * 0.4,
        height,
      },
      kit.fill,
    );
    kit.fill.setAlphaf(1);
  }
}

function drawMonsters(canvas: SkCanvas, frame: Frame): void {
  const { view, layout, colors, kit, fx } = frame;
  for (const monster of view.monsters) {
    const row = fxEntry(fx, 'row', monster.id)?.values[0] ?? monster.row;
    const rect = cellRect(layout, { regionId: 'board', col: monster.col, row: 0 });
    if (rect === null) continue;
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height * (row + 0.5);
    const flash = fxEntry(fx, 'flash', monster.id)?.values[0] ?? 0;
    kit.fill.setColor(flash > 0.5 ? colors.color.number : colors.color.monster);
    canvas.drawCircle(cx, cy, rect.width * 0.38, kit.fill);
    if (kit.numberFont !== null) {
      kit.fill.setColor(colors.color.number);
      const label = { text: monster.hpText, cx, y: cy + rect.width * 0.12 };
      drawCenteredText(canvas, label, { font: kit.numberFont, paint: kit.fill });
    }
  }
}

function drawBursts(canvas: SkCanvas, frame: Frame): void {
  const { view, layout, colors, kit, fx } = frame;
  for (let col = 0; col < view.cols; col += 1) {
    const burst = fxEntry(fx, 'burst', col);
    const base = cellRect(layout, { regionId: 'board', col, row: view.rows - 1 });
    if (burst === undefined || base === null || burst.progress >= 1 || burst.ageMs <= 0) continue;
    const spec = {
      seed: col,
      x: base.x + base.width / 2,
      y: base.y,
      count: BURST_COUNT,
      minSpeed: 60,
      maxSpeed: 220,
      gravity: 400,
      lifeMs: 600,
    };
    kit.fill.setColor(colors.color.beam);
    for (let i = 0; i < spec.count; i += 1) {
      const particle = sampleParticle(spec, i, burst.ageMs);
      kit.fill.setAlphaf(particle.alpha);
      canvas.drawCircle(particle.x, particle.y, base.width * 0.06, kit.fill);
    }
    kit.fill.setAlphaf(1);
  }
}

/** Ghost block one cell above the finger, snapped to the hovered cell (spec: thumb must not hide it). */
function drawGhost(canvas: SkCanvas, frame: Frame): void {
  const { pointer } = frame.fx;
  if (!pointer.isDown || pointer.hover?.regionId !== 'board') return;
  const rect = cellRect(frame.layout, {
    ...pointer.hover,
    row: Math.max(0, pointer.hover.row - 1),
  });
  if (rect === null) return;
  frame.kit.fill.setColor(frame.colors.color.ghost);
  canvas.drawRRect({ rect, rx: rect.width * CORNER, ry: rect.width * CORNER }, frame.kit.fill);
}

export function drawBoard(canvas: SkCanvas, frame: Frame): void {
  canvas.drawColor(frame.colors.color.background);
  drawCells(canvas, frame);
  drawBeams(canvas, frame);
  drawMonsters(canvas, frame);
  drawBursts(canvas, frame);
  drawGhost(canvas, frame);
}
```

```ts
// packages/shell/src/game-host/draw-centered-text.ts
'worklet';

import type { SkCanvas, SkFont, SkPaint } from '@shopify/react-native-skia';

/**
 * Width of a run of digits/Latin text. Uses glyph widths because SkFont.measureText is not
 * implemented in Skia's CanvasKit build (returns a jest.fn in Jest, throws in Node headless).
 */
export function textWidth(font: SkFont, text: string): number {
  let width = 0;
  for (const glyphWidth of font.getGlyphWidths(font.getGlyphIDs(text))) width += glyphWidth;
  return width;
}

export type CenteredText = {
  readonly text: string;
  readonly cx: number;
  /** Baseline y. */
  readonly y: number;
};

/** Draws already-localised digits (e.g. "۱۲") centred on cx. No shaping: digits and Latin only. */
export function drawCenteredText(
  canvas: SkCanvas,
  label: CenteredText,
  style: { readonly font: SkFont; readonly paint: SkPaint },
): void {
  canvas.drawText(
    label.text,
    label.cx - textWidth(style.font, label.text) / 2,
    label.y,
    style.paint,
    style.font,
  );
}
```

```ts
// apps/line-siege/src/board/to-view.ts
import type { LineSiegeState } from '@e07/line-siege/rules/line-siege-types.ts';
import type { ViewFormat } from '@e07/shell/game-host/board-types.ts';

export type MonsterView = {
  readonly id: number;
  readonly col: number;
  readonly row: number;
  readonly hpText: string;
};

/** Flat and serialisable: it is copied into a shared value once per move. */
export type LineSiegeView = {
  readonly cols: number;
  readonly rows: number;
  readonly cells: readonly number[];
  readonly monsters: readonly MonsterView[];
};

export function toView(state: LineSiegeState, format: ViewFormat): LineSiegeView {
  return {
    cols: state.cols,
    rows: state.rows,
    cells: state.cells,
    monsters: state.monsters.map((m) => ({
      id: m.id,
      col: m.col,
      row: m.row,
      hpText: format.formatNumber(m.hp),
    })),
  };
}
```

```ts
// apps/line-siege/src/board/line-siege-board.ts

import { drawBoard } from './draw-board.ts';
import { layoutBoard } from './layout-board.ts';
import { toView } from './to-view.ts';

import type { BoardToken } from './board-palettes.ts';
import type { LineSiegeView } from './to-view.ts';
import type { LineSiegeState } from '@e07/line-siege/rules/line-siege-types.ts';
import type { GameBoard, SkiaApi } from '@e07/shell/game-host/board-types.ts';
import type { SkPath } from '@shopify/react-native-skia';

/** Unit-size (0…1) shapes built ONCE with the immutable-path API (Skia ≥ 2.6). */
function buildPaths(skia: SkiaApi): Readonly<Partial<Record<string, SkPath>>> {
  const shield = skia.PathBuilder.Make()
    .moveTo(0.5, 0.05)
    .lineTo(0.92, 0.22)
    .lineTo(0.8, 0.78)
    .lineTo(0.5, 0.95)
    .lineTo(0.2, 0.78)
    .lineTo(0.08, 0.22)
    .close()
    .build();
  return { shield };
}

export const lineSiegeBoard: GameBoard<LineSiegeState, LineSiegeView, BoardToken> = {
  isMirroredInRtl: false,
  toView,
  layout: layoutBoard,
  draw: drawBoard,
  buildPaths,
  describe: (view) => ({
    id: 'line-siege.board.summary',
    values: {
      monsters: view.monsters.length,
      filled: view.cells.filter((cell) => cell === 1).length,
    },
  }),
};
```

Performance rules of thumb (measured: 64 rounded rects + 200 particles + a sim held the simulator's 60 fps cap; a ProMotion device is not yet measured):

- keep one frame in the low thousands of draw calls; the budget test enforces a per-game number;
- more than a few hundred identical sprites → `<Atlas>` with a texture from `useTexture`/`usePictureAsTexture` (docs/09 covers sprite pre-rendering);
- never trigger a React render per frame: HUD numbers change on events only;
- profile Release builds only.

### 2.7 The real-time loop (Halo Drift)

The accumulator, the loop hook and its runner:

```ts
// packages/game-kit/src/timeline/fixed-step.ts
'worklet';

/** One simulation tick. The simulation never sees frame time, only tick counts. */
export const STEP_MS = 1000 / 120;
/** Longest frame gap we catch up on (backgrounding, ads, a GC pause): 250 ms. */
export const MAX_FRAME_MS = 250;

/** How many ticks to run this frame and the time left over for the next one. */
export type StepPlan = { readonly steps: number; readonly accMs: number };

/**
 * Accumulator for a fixed-step loop. `frameDtMs` is FrameInfo.timeSincePreviousFrame,
 * which is null on the first frame after (re)activation: that frame simulates nothing.
 */
export function planSteps(accMs: number, frameDtMs: number | null): StepPlan {
  const dt = frameDtMs === null ? 0 : Math.min(Math.max(frameDtMs, 0), MAX_FRAME_MS);
  let acc = accMs + dt;
  let steps = 0;
  while (acc >= STEP_MS) {
    acc -= STEP_MS;
    steps += 1;
  }
  return { steps, accMs: acc };
}
```

```ts
// packages/shell/src/game-host/run-loop-frame.ts
'worklet';

import { scheduleOnRN } from 'react-native-worklets';

import { planSteps } from '@e07/game-kit/timeline/fixed-step.ts';

import { describeError } from './describe-error.ts';

import type { SharedValue } from 'react-native-reanimated';

/** Everything the real-time loop's frame callback needs; JS callbacks arrive via scheduleOnRN. */
export type LoopFrameWiring<TSim> = {
  readonly sim: SharedValue<TSim>;
  readonly command: SharedValue<number>;
  readonly accMs: SharedValue<number>;
  readonly step: (sim: TSim, command: number) => void;
  readonly drainEvents: (sim: TSim) => readonly number[];
  readonly onEvents: (events: readonly number[]) => void;
  readonly onError: (message: string) => void;
};

export function runLoopFrame<TSim>(wiring: LoopFrameWiring<TSim>, frameDtMs: number | null): void {
  try {
    const plan = planSteps(wiring.accMs.get(), frameDtMs);
    wiring.accMs.set(plan.accMs);
    if (plan.steps === 0) return;
    const input = wiring.command.get();
    const state = wiring.sim.get(); // on the UI thread: the live object, not a copy
    for (let i = 0; i < plan.steps; i += 1) wiring.step(state, input);
    const events = wiring.drainEvents(state);
    wiring.sim.modify(); // mutated in place: force listeners (the board picture) to re-run
    if (events.length > 0) scheduleOnRN(wiring.onEvents, events);
  } catch (error) {
    scheduleOnRN(wiring.onError, describeError(error));
  }
}
```

```ts
// packages/shell/src/game-host/use-fixed-step-loop.ts
import { useEffect, useRef } from 'react';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';

import { runLoopFrame } from './run-loop-frame.ts';

import type { FrameCallback, SharedValue } from 'react-native-reanimated';

/** What a real-time game provides. Both functions are worklets that mutate `sim` in place. */
export type FixedStepSim<TSim> = {
  /** Advance exactly one tick with the current input command. */
  readonly step: (sim: TSim, command: number) => void;
  /** Copy out and clear this frame's events (hits, deaths, wave end) as a flat int list. */
  readonly drainEvents: (sim: TSim) => readonly number[];
};

export type FixedStepLoop = { readonly start: () => void; readonly stop: () => void };

type LoopWiring<TSim> = {
  readonly sim: SharedValue<TSim>;
  /** Current input command (quantised integer, written by gesture worklets). */
  readonly command: SharedValue<number>;
  readonly game: FixedStepSim<TSim>;
  /** JS: batched events for sound, HUD, stats and save points; at most once per frame. */
  readonly onEvents: (events: readonly number[]) => void;
  readonly onError: (message: string) => void;
};

export function useFixedStepLoop<TSim>(input: LoopWiring<TSim>): FixedStepLoop {
  const accMs = useSharedValue(0);
  const frameRef = useRef<FrameCallback | null>(null);
  const handleError = (message: string): void => {
    frameRef.current?.setActive(false);
    input.onError(message);
  };
  const { sim, command, game, onEvents } = input;
  const wiring = {
    sim,
    command,
    accMs,
    step: game.step,
    drainEvents: game.drainEvents,
    onEvents,
    onError: handleError,
  };
  const frame = useFrameCallback((info) => {
    runLoopFrame(wiring, info.timeSincePreviousFrame);
  }, false);
  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);
  return {
    start: () => {
      accMs.set(0);
      frame.setActive(true);
    },
    stop: () => {
      frame.setActive(false);
    },
  };
}
```

A sim skeleton (the only folder where typed arrays are mutated in place, docs/04 rule 14):

```ts
// apps/halo-drift/src/sim/halo-sim.ts
'worklet';

import { nextU32, seedRng } from '@e07/game-kit/rng/sfc32.ts';

import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

/** Flat typed-array state: lives in ONE shared value, mutated in place on the UI thread. */
export type HaloSim = {
  /** Per entity, stride 4: x, y, vx, vy. Entity 0 is the player. */
  readonly body: Float32Array;
  /** [tick, entityCount, lastCommand, eventCount, …event ints]. */
  readonly ints: Int32Array;
  readonly rng: Uint32Array;
};

export const MAX_ENTITIES = 64;
export const EVENT_INPUT = 1;
export const EVENT_HIT = 2;
const TICK = 0;
const COUNT = 1;
const LAST_COMMAND = 2;
const EVENT_COUNT = 3;
const EVENTS = 4;
const ARENA = 1000;
const PLAYER_SPEED = 3;
const ENEMY_SPEED = 1;
const HIT_RADIUS = 24;
/** 16 compass directions for the one-thumb stick (command 1…16; 0 = idle). */
const STICK = [
  1, 0, 0.92388, 0.38268, 0.70711, 0.70711, 0.38268, 0.92388, 0, 1, -0.38268, 0.92388, -0.70711,
  0.70711, -0.92388, 0.38268, -1, 0, -0.92388, -0.38268, -0.70711, -0.70711, -0.38268, -0.92388, 0,
  -1, 0.38268, -0.92388, 0.70711, -0.70711, 0.92388, -0.38268,
];

/** Draws from the sim's own sfc32 state, stored as 4 words in `sim.rng`. */
function drawU32(sim: HaloSim): number {
  const state: RngState = [sim.rng[0] ?? 0, sim.rng[1] ?? 0, sim.rng[2] ?? 0, sim.rng[3] ?? 0];
  const draw = nextU32(state);
  sim.rng.set(draw.state);
  return draw.value;
}

export function createHaloSim(seed: number, enemies: number): HaloSim {
  const sim: HaloSim = {
    body: new Float32Array(MAX_ENTITIES * 4),
    ints: new Int32Array(EVENTS + 256),
    rng: Uint32Array.from(seedRng(seed)),
  };
  const count = Math.min(enemies + 1, MAX_ENTITIES);
  sim.ints[COUNT] = count;
  sim.body[0] = ARENA / 2;
  sim.body[1] = ARENA / 2;
  for (let e = 1; e < count; e += 1) {
    sim.body[e * 4] = drawU32(sim) % ARENA;
    sim.body[e * 4 + 1] = drawU32(sim) % ARENA;
  }
  return sim;
}

function pushEvent(sim: HaloSim, kind: number, value: number): void {
  const at = EVENTS + (sim.ints[EVENT_COUNT] ?? 0) * 3;
  if (at + 2 >= sim.ints.length) return;
  sim.ints[at] = kind;
  sim.ints[at + 1] = value;
  sim.ints[at + 2] = sim.ints[TICK] ?? 0;
  sim.ints[EVENT_COUNT] = (sim.ints[EVENT_COUNT] ?? 0) + 1;
}

function movePlayer(sim: HaloSim, command: number): void {
  const dx = command === 0 ? 0 : (STICK[(command - 1) * 2] ?? 0);
  const dy = command === 0 ? 0 : (STICK[(command - 1) * 2 + 1] ?? 0);
  sim.body[0] = Math.min(ARENA, Math.max(0, (sim.body[0] ?? 0) + dx * PLAYER_SPEED));
  sim.body[1] = Math.min(ARENA, Math.max(0, (sim.body[1] ?? 0) + dy * PLAYER_SPEED));
}

function chase(sim: HaloSim, e: number): void {
  const dx = (sim.body[0] ?? 0) - (sim.body[e * 4] ?? 0);
  const dy = (sim.body[1] ?? 0) - (sim.body[e * 4 + 1] ?? 0);
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance < HIT_RADIUS) {
    pushEvent(sim, EVENT_HIT, e);
    sim.body[e * 4] = drawU32(sim) % ARENA;
    return;
  }
  sim.body[e * 4] = (sim.body[e * 4] ?? 0) + (dx / distance) * ENEMY_SPEED;
  sim.body[e * 4 + 1] = (sim.body[e * 4 + 1] ?? 0) + (dy / distance) * ENEMY_SPEED;
}

/** One fixed tick. Records every command change as (tick, command) for replays. */
export function stepHaloSim(sim: HaloSim, command: number): void {
  if (command !== sim.ints[LAST_COMMAND]) {
    pushEvent(sim, EVENT_INPUT, command);
    sim.ints[LAST_COMMAND] = command;
  }
  movePlayer(sim, command);
  for (let e = 1; e < (sim.ints[COUNT] ?? 0); e += 1) chase(sim, e);
  sim.ints[TICK] = (sim.ints[TICK] ?? 0) + 1;
}

/** Copies this frame's events out as [kind, value, tick, …] and clears the queue. */
export function drainHaloEvents(sim: HaloSim): readonly number[] {
  const count = sim.ints[EVENT_COUNT] ?? 0;
  const events = Array.from(sim.ints.subarray(EVENTS, EVENTS + count * 3));
  sim.ints[EVENT_COUNT] = 0;
  return events;
}
```

Rules for sims:

- **State:** one plain object of typed arrays in `useSharedValue(createHaloSim(seed, …))`. On the UI thread `sim.get()` returns the live object; after mutating, `sim.modify()` (no argument) notifies listeners so the picture re-records. JS reads with `sim.get()` receive a copy (use it for save points and the debug export).
- **Input:** gesture worklets write an integer command (Halo Drift: stick direction 0…16) into a `command` shared value; the sim records every change as an `EVENT_INPUT (tick, command)`. Never feed floats from gestures into the sim.
- **Events:** the sim appends `[kind, value, tick]` triples; `runLoopFrame` drains them once per frame and sends them to JS for sound, HUD, stats and save points.
- **Save points:** end of wave, pause, background (never per frame): stop the loop, then read `sim.get()` on JS and save it with the recorded input log.
- **Time:** everything in gameplay counts ticks (`ints[TICK]`), never milliseconds.

Verified on the simulator: the loop ran 31 entities (30 enemies and the player) for 10 s at a steady 115.9 ticks/s while the display ran at 60 fps (target 120 ticks/s; see Open issues), delivered hit events to JS and rendered every frame; a replay of the recorded `(tick, command)` log reproduces the final state bit-exactly in Jest regardless of how ticks were grouped into frames:

```ts
// apps/halo-drift/src/sim/halo-sim.test.ts
import { EVENT_INPUT, createHaloSim, drainHaloEvents, stepHaloSim } from './halo-sim.ts';

import type { HaloSim } from './halo-sim.ts';

type Recording = { readonly tick: number; readonly command: number };

function fingerprint(sim: HaloSim): string {
  return `${Array.from(sim.body).join(',')}|${Array.from(sim.ints.subarray(0, 3)).join(',')}`;
}

/** Plays `ticks` ticks, grouping them into "frames" of varying size like a real display would. */
function play(
  seed: number,
  ticks: number,
  commandAt: (tick: number) => number,
): { sim: HaloSim; inputs: Recording[] } {
  const sim = createHaloSim(seed, 20);
  const inputs: Recording[] = [];
  let tick = 0;
  while (tick < ticks) {
    const frameSteps = 1 + (tick % 3);
    for (let s = 0; s < frameSteps && tick < ticks; s += 1, tick += 1)
      stepHaloSim(sim, commandAt(tick));
    const events = drainHaloEvents(sim);
    for (let e = 0; e < events.length; e += 3) {
      if (events[e] === EVENT_INPUT)
        inputs.push({ command: events[e + 1] ?? 0, tick: events[e + 2] ?? 0 });
    }
  }
  return { sim, inputs };
}

function replay(seed: number, ticks: number, inputs: readonly Recording[]): HaloSim {
  const sim = createHaloSim(seed, 20);
  let command = 0;
  let next = 0;
  for (let tick = 0; tick < ticks; tick += 1) {
    const change = inputs[next];
    if (change?.tick === tick) {
      command = change.command;
      next += 1;
    }
    stepHaloSim(sim, command);
  }
  return sim;
}

describe('halo drift simulation', () => {
  it('replays a recorded run exactly from its (tick, command) log', () => {
    const recorded = play(7, 1200, (tick) => (tick >> 5) % 17);
    expect(fingerprint(replay(7, 1200, recorded.inputs))).toBe(fingerprint(recorded.sim));
  });

  it('gives the same result however ticks are grouped into frames', () => {
    const bot = (tick: number): number => (tick * 7) % 17;
    const grouped = play(3, 900, bot).sim;
    const single = createHaloSim(3, 20);
    for (let tick = 0; tick < 900; tick += 1) stepHaloSim(single, bot(tick));
    expect(fingerprint(single)).toBe(fingerprint(grouped));
  });
});
```

**Simulate-then-replay** (Bank Shot volleys, Toggle Drop ball runs, Poker Drop cascades): the continuous phase runs inside `applyMove` with the same fixed step, and the result is an ordinary event list with timestamps (`{ kind: 'ball-bounced', ballId, x, y, atMs }`). `buildTimeline` turns it into tracks. These games stay turn-based for saving, undo, bots and goldens; only the pictures move in real time.

### 2.8 The gesture pipeline

```
Gesture.Tap/LongPress/Pan (UI thread)
  → hitTest(layout, point, HIT_SLOP)            same layout the renderer uses
  → classifySwipe(...) | drag from→to | aim     panIntent(): at most ONE intent per gesture
  → scheduleOnRN(onIntent, intent)              JS thread
  → game.intentToMove(state, intent) → Move | null
  → session.dispatch(apply-move)
```

```ts
// packages/shell/src/game-host/pan-intent.ts
'worklet';

import { hitTest } from '@e07/game-kit/geom/board-layout.ts';
import { classifySwipe } from '@e07/game-kit/geom/classify-swipe.ts';

import type { PointerSample } from './board-types.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardLayout } from '@e07/game-kit/geom/board-layout.ts';

/** How a game uses pan gestures; set once per game in its board config. */
export type PanMode = 'none' | 'swipe' | 'drag' | 'aim';

/** Extra hit area (pt) around regions, so edge taps still land (spec S5: 44 pt targets). */
export const HIT_SLOP = 8;

export type PanRelease = {
  readonly x: number;
  readonly y: number;
  readonly translationX: number;
  readonly translationY: number;
  readonly velocityX: number;
  readonly velocityY: number;
};

export type PanIntentInput = {
  readonly mode: PanMode;
  readonly pointer: PointerSample;
  readonly release: PanRelease;
  readonly layout: BoardLayout;
};

/** Turns a finished pan into at most ONE intent, so a gesture can never produce two moves. */
export function panIntent(input: PanIntentInput): InputIntent | null {
  const { mode, pointer, release, layout } = input;
  switch (mode) {
    case 'none':
      return null;
    case 'swipe': {
      const swipe = {
        dx: release.translationX,
        dy: release.translationY,
        vx: release.velocityX,
        vy: release.velocityY,
      };
      const direction = classifySwipe(swipe);
      return direction === null ? null : { kind: 'swipe', direction, from: pointer.dragFrom };
    }
    case 'drag':
      return pointer.dragFrom === null
        ? null
        : { kind: 'drag-end', from: pointer.dragFrom, to: hitTest(layout, release, HIT_SLOP) };
    case 'aim':
      return { kind: 'aim', dx: release.translationX, dy: release.translationY };
  }
}
```

```ts
// packages/shell/src/game-host/use-board-gestures.ts
// The ONLY file that imports gesture builders from react-native-gesture-handler.
// RNGH 2.32 builder API (Expo SDK 57). Moving to the v3 hook API rewrites this file only.
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { hitTest, isSameTarget } from '@e07/game-kit/geom/board-layout.ts';

import { IDLE_POINTER } from './board-types.ts';
import { HIT_SLOP, panIntent } from './pan-intent.ts';

import type { PointerSample } from './board-types.ts';
import type { PanMode } from './pan-intent.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardLayout, BoardTarget } from '@e07/game-kit/geom/board-layout.ts';
import type {
  ExclusiveGesture,
  LongPressGesture,
  PanGesture,
  TapGesture,
} from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';

const TAP_MAX_MS = 250;
const LONG_PRESS_MS = 450;
const PAN_MIN_DISTANCE = 10;

export type BoardGestureHandlers = {
  readonly panMode: PanMode;
  readonly onIntent: (intent: InputIntent) => void;
  /** Hovered cell changed during a drag (JS computes a legality preview). */
  readonly onHover: (target: BoardTarget | null) => void;
};

export type BoardGestures = {
  readonly gesture: ExclusiveGesture;
  readonly pointer: SharedValue<PointerSample>;
};

type Wiring = {
  readonly layout: SharedValue<BoardLayout>;
  readonly pointer: SharedValue<PointerSample>;
  readonly handlers: BoardGestureHandlers;
};

function makeTap({ layout, handlers }: Wiring): TapGesture {
  const { onIntent } = handlers;
  return Gesture.Tap()
    .withTestId('board.tap')
    .maxDuration(TAP_MAX_MS)
    .onEnd((event, isSuccess) => {
      const target = isSuccess ? hitTest(layout.get(), event, HIT_SLOP) : null;
      if (target !== null) scheduleOnRN(onIntent, { kind: 'tap', target });
    });
}

function makeLongPress({ layout, handlers }: Wiring): LongPressGesture {
  const { onIntent } = handlers;
  return Gesture.LongPress()
    .withTestId('board.long-press')
    .minDuration(LONG_PRESS_MS)
    .onStart((event) => {
      const target = hitTest(layout.get(), event, HIT_SLOP);
      if (target !== null) scheduleOnRN(onIntent, { kind: 'long-press', target });
    });
}

function makePan({ layout, pointer, handlers }: Wiring): PanGesture {
  const { onIntent, onHover, panMode } = handlers;
  return Gesture.Pan()
    .withTestId('board.pan')
    .enabled(panMode !== 'none')
    .minDistance(PAN_MIN_DISTANCE)
    .onStart((event) => {
      const origin = { x: event.x - event.translationX, y: event.y - event.translationY };
      const dragFrom = hitTest(layout.get(), origin, HIT_SLOP);
      pointer.set({ isDown: true, x: event.x, y: event.y, hover: dragFrom, dragFrom });
    })
    .onUpdate((event) => {
      const previous = pointer.get();
      const hover = hitTest(layout.get(), event, HIT_SLOP);
      pointer.set({ ...previous, x: event.x, y: event.y, hover });
      if (!isSameTarget(hover, previous.hover)) scheduleOnRN(onHover, hover);
    })
    .onEnd((event, isSuccess) => {
      const intent = isSuccess
        ? panIntent({ mode: panMode, pointer: pointer.get(), release: event, layout: layout.get() })
        : null;
      if (intent !== null) scheduleOnRN(onIntent, intent);
    })
    .onFinalize(() => {
      pointer.set(IDLE_POINTER);
    });
}

/** One Exclusive composition per board: pan beats long-press beats tap. */
export function useBoardGestures(
  layout: SharedValue<BoardLayout>,
  handlers: BoardGestureHandlers,
): BoardGestures {
  const pointer = useSharedValue<PointerSample>(IDLE_POINTER);
  const wiring = { layout, pointer, handlers };
  const gesture = Gesture.Exclusive(makePan(wiring), makeLongPress(wiring), makeTap(wiring));
  return { gesture, pointer };
}
```

```ts
// apps/line-siege/src/rules/intent-to-move.ts
import type { LineSiegeMove, LineSiegeState } from './line-siege-types.ts';
import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

function placementTarget(intent: InputIntent): BoardTarget | null {
  switch (intent.kind) {
    case 'tap':
      return intent.target;
    case 'drag-end':
      return intent.to;
    case 'long-press':
    case 'swipe':
    case 'aim':
      return null;
  }
}

/** Pure: an intent becomes a legal move or nothing. Legality lives here, never in gestures. */
export function intentToMove(state: LineSiegeState, intent: InputIntent): LineSiegeMove | null {
  const target = placementTarget(intent);
  if (target?.regionId !== 'board') return null;
  const index = target.row * state.cols + target.col;
  return state.cells[index] === 0 ? { kind: 'place', col: target.col, row: target.row } : null;
}
```

Notes:

- `event.x/y` are canvas-local and physical; they do not mirror under RTL (verified with `forceRTL(true)`).
- `Gesture.Exclusive(pan, longPress, tap)`: a tap waits only until the finger lifts, so taps feel instant.
- Drag previews stay on the UI thread (`pointer` in `fx`); only hover **changes** go to JS (`onHover`), where the pure engine computes legality and the game shows it in the view.
- Wrap the app root in `GestureHandlerRootView` (docs/05's `ShellProviders`, section 3.14). Never mix RN `Pressable` with RNGH inside the board.
- Swipe thresholds (24 pt or 600 pt/s, dominance 1.2) and long-press (450 ms) are starting values; tune per game after play-testing.
- Continuous input (Halo Drift) is not a `panMode` yet. When that game is built, add a `stick` mode to `useBoardGestures` (still the only gesture file): `onUpdate` picks the nearest of the 16 committed unit vectors by largest dot product with the drag vector (no `atan2`) and writes `index + 1` to the loop's `command` shared value when it changes; `onFinalize` writes 0.

### 2.9 The determinism policy

What is allowed in `packages/game-kit/src/**` and `apps/*/src/{rules,levels,sim,geom}/**` is rule 9; docs/04 owns the ESLint block (`DETERMINISTIC`), and its verification rejected `Math.sin`, `Math.cos` and `**` in a rules folder while accepting `Math.floor` and `Math.PI`. Practical consequences:

- **No angles in simulation.** Reflection uses dot products (`reflect(v, n)`); directions come from committed tables (16 unit vectors generated once with Node and pasted as literals, see `particles.ts` and `halo-sim.ts`); aim comes from the drag vector normalised with `Math.sqrt`.
- **Integers where possible.** HP, scores, grid positions and ticks are integers; floats are fine for positions because `+ - * /` and `sqrt` are correctly rounded everywhere.
- **Rendering may use trigonometry** (it is not simulation and goldens compare Jest with Jest), but board code stays within the policy anyway so particles and shake replay identically.
- **Clocks never enter rules.** Time arrives as ticks or as `ClockPort` values passed in (the daily seed is `dailySeed(dateKey, levels.daily.salt)` from `@e07/game-kit/dates/daily-seed.ts`, docs/06 section 8.1).

### 2.10 Worklet rules

- **File-level directive.** `'worklet';` as the first statement (after the path comment) workletizes every top-level function of the file. Verified with SDK 57's `babel-preset-expo` (57.0.13) and Worklets 0.10.1: `vec2.ts` produced 7 worklets (7 functions), a file without the directive 0; on the simulator, draw/layout/timeline modules ran on the UI thread in a Release build with React Compiler on.
- **Imports.** A worklet can call another worklet imported from a module (it is captured in its closure). It cannot call a plain JS function: that throws on the UI thread at runtime. Type-only imports are erased and always fine.
- **Closures are copies.** Values captured by a worklet are copied when it is first scheduled; later reassignments on JS are invisible. Anything that changes goes through a shared value.
- **Not hoisted.** Define helper worklets before they run (all our helpers are module-level functions, so this is automatic).
- **No third-party code on the UI thread** (Bundle Mode is not enabled), no promises, no `await`, no `setTimeout` in worklets.
- **Skia objects are fine to capture.** Host objects (paints, fonts, paths, paragraphs, pictures, the recorder) captured in the kit are shared, not copied.
- **Boundary check.** The checker below runs as a Jest test inside `npm test` (no CLI entry: docs/04 keeps `import.meta` out of modules that Jest transforms):

```ts
// packages/tooling/src/quality/check-worklet-boundary.ts
// Pure checker, run by check-worklet-boundary.test.ts inside `npm test` (no CLI: docs/04 keeps
// import.meta out of modules that Jest transforms).
// UI-thread modules (file-level 'worklet' directive) may import VALUES only from other
// UI-thread modules or from ALLOWED_PACKAGES. Type-only imports are erased and always fine.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';

const ROOT = process.cwd();
const ALLOWED_PACKAGES = new Set(['react-native-worklets']);
/** Folders whose modules must be UI-thread modules (tests excluded). */
const REQUIRED = [
  /^packages\/game-kit\/src\/(rng|geom|timeline)\/[^/]+\.ts$/,
  /^apps\/[^/]+\/src\/board\/(draw|layout)[^/]*\.ts$/,
  /^apps\/[^/]+\/src\/sim\/.+\.ts$/,
];
const DIRECTIVE = /^(?:\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/))*\s*['"]worklet['"];/;
const VALUE_IMPORT = /^\s*(?:import|export)\s+(?!type\b)[^'";]*?from\s+['"]([^'"]+)['"]/gm;

export type Violation = { readonly file: string; readonly problem: string };

function isWorkletSource(source: string): boolean {
  return DIRECTIVE.test(source);
}

/** Maps a specifier to a repo-relative file, or null for an external package. */
export function resolveSpecifier(fromFile: string, specifier: string): string | null {
  if (specifier.startsWith('.')) return normalize(join(dirname(fromFile), specifier));
  const match = /^@e07\/([^/]+)\/(.+)$/.exec(specifier);
  if (match === null) return null;
  const [, pkg = '', rest = ''] = match;
  const base =
    pkg === 'game-kit' || pkg === 'shell' || pkg === 'tooling' ? `packages/${pkg}` : `apps/${pkg}`;
  return `${base}/src/${rest}`;
}

export function checkFile(file: string, read: (path: string) => string): readonly Violation[] {
  const source = read(file);
  const violations: Violation[] = [];
  if (REQUIRED.some((pattern) => pattern.test(file)) && !isWorkletSource(source)) {
    violations.push({ file, problem: "missing file-level 'worklet'; directive" });
  }
  if (!isWorkletSource(source)) return violations;
  for (const [, specifier = ''] of source.matchAll(VALUE_IMPORT)) {
    const target = resolveSpecifier(file, specifier);
    if (target === null) {
      if (!ALLOWED_PACKAGES.has(specifier))
        violations.push({ file, problem: `value import from package ${specifier}` });
    } else if (!isWorkletSource(read(target))) {
      violations.push({ file, problem: `value import from non-worklet module ${target}` });
    }
  }
  return violations;
}

export function sourceFiles(): string[] {
  const roots = ['packages', 'apps'];
  return roots.flatMap((root) =>
    readdirSync(join(ROOT, root), { recursive: true, encoding: 'utf8' })
      .map((path) => relative(ROOT, join(ROOT, root, path)))
      .filter((path) => /\/src\/.+\.tsx?$/.test(path) && !/\.test\.tsx?$|node_modules/.test(path)),
  );
}

export function checkRepo(): readonly Violation[] {
  const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');
  return sourceFiles().flatMap((file) => checkFile(file, read));
}
```

```ts
// packages/tooling/src/quality/check-worklet-boundary.test.ts
import { checkFile, checkRepo } from './check-worklet-boundary.ts';

const FILES: Readonly<Record<string, string>> = {
  'packages/game-kit/src/geom/a.ts':
    "'worklet';\nimport { b } from './b.ts';\nimport type { C } from './c.ts';\n",
  'packages/game-kit/src/geom/b.ts': "'worklet';\nexport const b = 1;\n",
  'packages/game-kit/src/geom/c.ts': 'export type C = number;\n',
  'packages/game-kit/src/geom/bad.ts': "'worklet';\nimport { c } from './c.ts';\n",
};
const read = (path: string): string => FILES[path] ?? '';

describe('worklet boundary', () => {
  it('allows value imports between UI-thread modules and type imports from anywhere', () => {
    expect(checkFile('packages/game-kit/src/geom/a.ts', read)).toStrictEqual([]);
  });

  it('flags a UI-thread module importing a value from a JS-only module', () => {
    expect(checkFile('packages/game-kit/src/geom/bad.ts', read)).toHaveLength(1);
  });

  it('finds no violations in this repository', () => {
    expect(checkRepo()).toStrictEqual([]);
  });
});
```

### 2.11 The seeded PRNG

`sfc32` (Chris Doty-Humphrey, PractRand) passes PractRand, has a 128-bit state and uses only 32-bit integer operations, so every JS engine produces the same sequence. State is four uint32 numbers, JSON-serialisable, stored inside the game state; `nextU32` returns the value and the next state (no hidden mutation). The golden sequence below is a compatibility contract: changing it breaks every daily challenge and every saved replay. *Sources:* [PractRand RNG engines](https://pracrand.sourceforge.net/RNG_engines.txt), [bryc/code PRNGs](https://github.com/bryc/code/blob/master/jshash/PRNGs.md).

```ts
// packages/game-kit/src/rng/sfc32.ts
'worklet';

/** sfc32 state: four unsigned 32-bit integers. Plain numbers, so it is JSON-serialisable. */
export type RngState = readonly [number, number, number, number];

/** One draw: the value (0 … 2^32-1) and the state to use next. */
export type RngDraw = { readonly value: number; readonly state: RngState };

const GOLDEN_GAMMA = 0x9e3779b9;
const WARM_UP_DRAWS = 12;
const TWO_POW_32 = 4294967296;

/** Integer avalanche mix (murmur3 finaliser). Only imul, xor and shifts: exact on every engine. */
export function mix32(value: number): number {
  let z = value | 0;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
  return (z ^ (z >>> 16)) >>> 0;
}

/** Stateless hash of two integers, for per-index randomness (particles, tile variants). */
export function hashU32(a: number, b: number): number {
  return mix32(a ^ Math.imul(b | 0, GOLDEN_GAMMA));
}

/** Advances sfc32 once (Chris Doty-Humphrey's PractRand sfc32: tmp = a + b + counter++). */
export function nextU32(state: RngState): RngDraw {
  const [a, b, c, d] = state;
  const t = (((a + b) | 0) + d) | 0;
  const nextD = (d + 1) | 0;
  const nextA = b ^ (b >>> 9);
  const nextB = (c + (c << 3)) | 0;
  const rotated = (c << 21) | (c >>> 11);
  const nextC = (rotated + t) | 0;
  return { value: t >>> 0, state: [nextA >>> 0, nextB >>> 0, nextC >>> 0, nextD >>> 0] };
}

/** Expands any integer seed into a warmed-up state. */
export function seedRng(seed: number): RngState {
  const s = seed | 0;
  let state: RngState = [
    mix32(s + GOLDEN_GAMMA),
    mix32(s + 2 * GOLDEN_GAMMA),
    mix32(s + 3 * GOLDEN_GAMMA),
    mix32(s + 4 * GOLDEN_GAMMA),
  ];
  for (let i = 0; i < WARM_UP_DRAWS; i += 1) {
    state = nextU32(state).state;
  }
  return state;
}

/** Unbiased integer in [0, maxExclusive), by rejection sampling. maxExclusive: 1 … 2^32. */
export function nextInt(state: RngState, maxExclusive: number): RngDraw {
  const limit = TWO_POW_32 - (TWO_POW_32 % maxExclusive);
  let draw = nextU32(state);
  while (draw.value >= limit) {
    draw = nextU32(draw.state);
  }
  return { value: draw.value % maxExclusive, state: draw.state };
}

/** Float in [0, 1). Division is correctly rounded (IEEE 754), so this is deterministic too. */
export function nextUnit(state: RngState): RngDraw {
  const draw = nextU32(state);
  return { value: draw.value / TWO_POW_32, state: draw.state };
}

/** FNV-1a over UTF-16 code units: turns a text key such as "line-siege:2026-09-26" into a seed. The
 * Shell's daily seed is docs/06's dailySeed(dateKey, salt) in game-kit/dates/daily-seed.ts. */
export function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  }
  return hash >>> 0;
}
```

```ts
// packages/game-kit/src/rng/sfc32.test.ts
import fc from 'fast-check';

import { hashSeed, nextInt, nextU32, seedRng } from './sfc32.ts';

import type { RngState } from './sfc32.ts';

function drawMany(state: RngState, count: number): number[] {
  const values: number[] = [];
  let current = state;
  for (let i = 0; i < count; i += 1) {
    const draw = nextU32(current);
    values.push(draw.value);
    current = draw.state;
  }
  return values;
}

/** Independent transcription of PractRand's C sfc32, used as the oracle. */
function referenceSfc32(seed: readonly number[], count: number): number[] {
  let [a = 0, b = 0, c = 0, d = 0] = seed;
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const tmp = (a + b + d) >>> 0;
    d = (d + 1) >>> 0;
    a = (b ^ (b >>> 9)) >>> 0;
    b = (c + (c << 3)) >>> 0;
    c = ((((c << 21) | (c >>> 11)) >>> 0) + tmp) >>> 0;
    out.push(tmp);
  }
  return out;
}

describe('sfc32', () => {
  it('matches the PractRand reference algorithm', () => {
    const state: RngState = [1, 2, 3, 4];
    expect(drawMany(state, 50)).toStrictEqual(referenceSfc32(state, 50));
  });

  it('keeps the pinned golden sequence for seed 1 (daily-challenge compatibility contract)', () => {
    expect(drawMany(seedRng(1), 5)).toStrictEqual(GOLDEN_SEED_1);
  });

  it('returns the same sequence for the same seed', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        expect(drawMany(seedRng(seed), 20)).toStrictEqual(drawMany(seedRng(seed), 20));
      }),
      { seed: 42, numRuns: 300 },
    );
  });

  it('keeps nextInt inside its range', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 1, max: 1000 }), (seed, max) => {
        const { value } = nextInt(seedRng(seed), max);
        expect(Number.isInteger(value) && value >= 0 && value < max).toBe(true);
      }),
      { seed: 7, numRuns: 500 },
    );
  });

  it('hashes daily keys stably', () => {
    expect(hashSeed('line-siege:2026-09-26')).toBe(GOLDEN_DAILY_HASH);
  });
});

const GOLDEN_SEED_1 = [1828152527, 3394835397, 2967886022, 2251045104, 4148684523];
const GOLDEN_DAILY_HASH = 2224665572;
```

A real-time sim keeps the four words in its own `Uint32Array` and advances them with `nextU32` + `rng.set(draw.state)` (see `drawU32` in `halo-sim.ts`).

### 2.12 The geom kit

```ts
// packages/game-kit/src/geom/vec2.ts
'worklet';

/** Immutable 2D vector in board or world units. */
export type Vec2 = { readonly x: number; readonly y: number };

/** The zero vector (also returned by normalize() for zero length). */
export const ZERO: Vec2 = { x: 0, y: 0 };

/** a + b. */
export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

/** a − b. */
export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

/** a · k. */
export function scale(a: Vec2, k: number): Vec2 {
  return { x: a.x * k, y: a.y * k };
}

/** Dot product; the basis of projection and reflection without angles. */
export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

/** Math.sqrt is correctly rounded by IEEE 754, so length() is deterministic everywhere. */
export function length(a: Vec2): number {
  return Math.sqrt(dot(a, a));
}

/** Unit vector in the direction of a, or ZERO. */
export function normalize(a: Vec2): Vec2 {
  const len = length(a);
  return len === 0 ? ZERO : { x: a.x / len, y: a.y / len };
}

/** Reflects velocity `v` off a surface with unit normal `n`: v − 2(v·n)n. No angles needed. */
export function reflect(v: Vec2, n: Vec2): Vec2 {
  const d = 2 * dot(v, n);
  return { x: v.x - d * n.x, y: v.y - d * n.y };
}
```

```ts
// packages/game-kit/src/geom/sweep.ts
'worklet';

import { dot, length, normalize, sub } from './vec2.ts';

import type { Vec2 } from './vec2.ts';

/** First contact of a moving circle: fraction `t` (0…1) of this step's motion, and the surface normal. */
export type SweepHit = { readonly t: number; readonly normal: Vec2 };

/** A circle and its motion over one fixed step. */
export type MovingCircle = {
  readonly center: Vec2;
  /** Motion during this step (velocity × step time). */
  readonly motion: Vec2;
  readonly radius: number;
};

/** A wall or edge from a to b. */
export type Segment = { readonly a: Vec2; readonly b: Vec2 };

/** Moving circle vs a fixed point (a segment end-cap): smallest t with |center + t·motion − p| = r. */
export function sweepCirclePoint(circle: MovingCircle, point: Vec2): SweepHit | null {
  const m = sub(circle.center, point);
  const a = dot(circle.motion, circle.motion);
  const b = dot(m, circle.motion);
  const c = dot(m, m) - circle.radius * circle.radius;
  if (a === 0 || b >= 0) return null;
  const discriminant = b * b - a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / a;
  if (t < 0 || t > 1) return null;
  const hit = {
    x: circle.center.x + circle.motion.x * t,
    y: circle.center.y + circle.motion.y * t,
  };
  return { t, normal: normalize(sub(hit, point)) };
}

/** Moving circle vs the segment's interior (the line offset by the radius, clipped to the segment). */
function sweepCircleEdge(circle: MovingCircle, segment: Segment): SweepHit | null {
  const edge = sub(segment.b, segment.a);
  const edgeLength = length(edge);
  if (edgeLength === 0) return null;
  const facing = normalize({ x: -edge.y, y: edge.x });
  const side = dot(sub(circle.center, segment.a), facing);
  const normal = side >= 0 ? facing : { x: -facing.x, y: -facing.y };
  const distance = Math.abs(side) - circle.radius;
  const approach = -dot(circle.motion, normal);
  if (approach <= 0 || distance < 0 || distance > approach) return null;
  const t = distance / approach;
  const hit = {
    x: circle.center.x + circle.motion.x * t,
    y: circle.center.y + circle.motion.y * t,
  };
  const along = dot(sub(hit, segment.a), edge) / (edgeLength * edgeLength);
  return along >= 0 && along <= 1 ? { t, normal } : null;
}

/** Earliest contact with a segment, including its rounded ends. Null = no contact this step. */
export function sweepCircleSegment(circle: MovingCircle, segment: Segment): SweepHit | null {
  const candidates = [
    sweepCircleEdge(circle, segment),
    sweepCirclePoint(circle, segment.a),
    sweepCirclePoint(circle, segment.b),
  ];
  let best: SweepHit | null = null;
  for (const hit of candidates) {
    if (hit !== null && (best === null || hit.t < best.t)) best = hit;
  }
  return best;
}

/** Overlap test without sqrt: squared distance vs squared radius sum. */
export function circlesOverlap(a: Vec2, b: Vec2, radiusSum: number): boolean {
  const d = sub(a, b);
  return dot(d, d) < radiusSum * radiusSum;
}
```

```ts
// packages/game-kit/src/geom/spatial-hash.ts
'worklet';

/**
 * Uniform-grid broad phase built by counting sort into caller-owned typed arrays,
 * so a per-tick rebuild on the UI thread allocates nothing (the FINAL B.13 typed-array
 * exception: writes go through local aliases of the scratch buffers).
 * cellStart/cursor have cols*rows+1 entries; items has one entry per entity.
 * Entities of cell c are items[cellStart[c]] … items[cellStart[c+1] - 1].
 */
export type SpatialHash = {
  readonly cellSize: number;
  readonly cols: number;
  readonly rows: number;
  readonly cellStart: Int32Array;
  readonly cursor: Int32Array;
  readonly items: Int32Array;
};

/** Allocates the scratch buffers once (at sim creation), never per tick. */
export function makeSpatialHash(
  grid: { cellSize: number; cols: number; rows: number },
  capacity: number,
): SpatialHash {
  const cells = grid.cols * grid.rows + 1;
  return {
    ...grid,
    cellStart: new Int32Array(cells),
    cursor: new Int32Array(cells),
    items: new Int32Array(capacity),
  };
}

/** Grid cell index of a point, clamped to the grid. */
export function cellOf(hash: SpatialHash, x: number, y: number): number {
  const col = Math.min(hash.cols - 1, Math.max(0, Math.floor(x / hash.cellSize)));
  const row = Math.min(hash.rows - 1, Math.max(0, Math.floor(y / hash.cellSize)));
  return row * hash.cols + col;
}

function entityCell(hash: SpatialHash, positions: Float32Array, index: number): number {
  return cellOf(hash, positions[index * 2] ?? 0, positions[index * 2 + 1] ?? 0);
}

/** Rebuilds `out` from interleaved positions [x0, y0, x1, y1, …] of `count` entities. */
export function rebuildSpatialHash(out: SpatialHash, positions: Float32Array, count: number): void {
  const starts = out.cellStart;
  starts.fill(0);
  for (let i = 0; i < count; i += 1) {
    const next = entityCell(out, positions, i) + 1;
    starts[next] = (starts[next] ?? 0) + 1;
  }
  for (let c = 1; c < starts.length; c += 1) starts[c] = (starts[c] ?? 0) + (starts[c - 1] ?? 0);
  const { cursor, items } = out;
  cursor.set(starts);
  for (let i = 0; i < count; i += 1) {
    const cell = entityCell(out, positions, i);
    const slot = cursor[cell] ?? 0;
    items[slot] = i;
    cursor[cell] = slot + 1;
  }
}
```

Collision recipe for Bank Shot, per fixed step: for each ball, sweep against every wall segment and brick edge (brick = 4 segments), take the earliest hit, move to it, `reflect` the velocity, spend the remaining fraction of the step, repeat at most 4 times per step. Property tests: a ball never leaves the arena, speed never increases, the same seed gives the same volley. If a future game needs stacking, joints or friction, the documented fallback is `planck` 1.5.0 on the JS thread, with replays treated as approximate ([npm](https://www.npmjs.com/package/planck)).

### 2.13 `BoardLayout` and hit-testing at any canvas size

Regions exist only for tappable cells. Free-form boards (Bank Shot, Halo Drift) scale their world to `layout.width`/`layout.height` and need no regions, so nothing in the Shell assumes a grid (spec 13).

```ts
// packages/game-kit/src/geom/board-layout.ts
'worklet';

/** Axis-aligned rectangle in canvas points; also accepted by SkCanvas draw calls as-is. */
export type Rect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/** A rectangular grid of square cells in canvas pixels (unmirrored coordinates). */
export type GridRegion = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly cell: number;
  readonly cols: number;
  readonly rows: number;
};

/** Pure function of the canvas size. Shared by draw() and hitTest(): they cannot drift. */
export type BoardLayout = {
  readonly width: number;
  readonly height: number;
  /** RTL mirroring for boards that opted in: positions mirror, glyphs never do. */
  readonly isMirrored: boolean;
  readonly regions: readonly GridRegion[];
};

/** A cell of a named region (board, tray, button strip): what hit-testing returns. */
export type BoardTarget = { readonly regionId: string; readonly col: number; readonly row: number };

/** Box to fill and the grid size to fit into it. */
export type FitInput = {
  readonly box: Rect;
  readonly cols: number;
  readonly rows: number;
};

/** Layout before the canvas has a size: no regions, so nothing is hit. */
export const EMPTY_LAYOUT: BoardLayout = { width: 0, height: 0, isMirrored: false, regions: [] };

/** Largest whole-pixel square cell that fits `box`, centred in it. */
export function fitGrid(input: FitInput): Omit<GridRegion, 'id'> {
  const cell = Math.max(
    0,
    Math.floor(Math.min(input.box.width / input.cols, input.box.height / input.rows)),
  );
  return {
    x: input.box.x + Math.floor((input.box.width - cell * input.cols) / 2),
    y: input.box.y + Math.floor((input.box.height - cell * input.rows) / 2),
    cell,
    cols: input.cols,
    rows: input.rows,
  };
}

function findRegion(layout: BoardLayout, regionId: string): GridRegion | undefined {
  return layout.regions.find((region) => region.id === regionId);
}

function mirrorRect(layout: BoardLayout, rect: Rect): Rect {
  return layout.isMirrored ? { ...rect, x: layout.width - rect.x - rect.width } : rect;
}

/** Where to draw a cell. Applies RTL mirroring, so draw code never branches on direction. */
export function cellRect(layout: BoardLayout, target: BoardTarget): Rect | null {
  const region = findRegion(layout, target.regionId);
  if (region === undefined) return null;
  const rect = {
    x: region.x + target.col * region.cell,
    y: region.y + target.row * region.cell,
    width: region.cell,
    height: region.cell,
  };
  return mirrorRect(layout, rect);
}

type Point = { readonly x: number; readonly y: number };

function regionHit(region: GridRegion, point: Point, slop: number): BoardTarget | null {
  const { x, y } = point;
  const width = region.cols * region.cell;
  const height = region.rows * region.cell;
  const isInside =
    x >= region.x - slop &&
    x < region.x + width + slop &&
    y >= region.y - slop &&
    y < region.y + height + slop;
  if (!isInside || region.cell <= 0) return null;
  const col = Math.min(region.cols - 1, Math.max(0, Math.floor((x - region.x) / region.cell)));
  const row = Math.min(region.rows - 1, Math.max(0, Math.floor((y - region.y) / region.cell)));
  return { regionId: region.id, col, row };
}

/** Canvas point → cell. `slop` (px) extends every region so edge taps still land. */
export function hitTest(layout: BoardLayout, point: Point, slop = 0): BoardTarget | null {
  const local = { x: layout.isMirrored ? layout.width - point.x : point.x, y: point.y };
  for (const region of layout.regions) {
    const hit = regionHit(region, local, slop);
    if (hit !== null) return hit;
  }
  return null;
}

/** Structural equality for targets (hover changes are sent to JS only when this is false). */
export function isSameTarget(a: BoardTarget | null, b: BoardTarget | null): boolean {
  if (a === null || b === null) return a === b;
  return a.regionId === b.regionId && a.col === b.col && a.row === b.row;
}
```

```ts
// packages/game-kit/src/geom/classify-swipe.ts
'worklet';

/** Physical directions on the board (boards do not mirror; see docs/08-game-engine.md). */
export type SwipeDirection = 'up' | 'down' | 'left' | 'right';

/** Pan release data: translation (pt) and velocity (pt/s). */
export type SwipeInput = {
  readonly dx: number;
  readonly dy: number;
  readonly vx: number;
  readonly vy: number;
};

/** Per-game tuning; starting values in DEFAULT_SWIPE. */
export type SwipeThresholds = {
  /** Minimum travel on the dominant axis, in points. */
  readonly minDistance: number;
  /** …or minimum release speed on the dominant axis, in points per second. */
  readonly minVelocity: number;
  /** Dominant axis must beat the other by this factor, else the swipe is ambiguous. */
  readonly dominance: number;
};

/** Starting values; tune per game in game.config.ts after play-testing. */
export const DEFAULT_SWIPE: SwipeThresholds = { minDistance: 24, minVelocity: 600, dominance: 1.2 };

function directionOf(input: SwipeInput, isHorizontal: boolean): SwipeDirection {
  if (isHorizontal) return input.dx > 0 ? 'right' : 'left';
  return input.dy > 0 ? 'down' : 'up';
}

/** Pan release → one physical direction, or null when too short or too diagonal. */
export function classifySwipe(
  input: SwipeInput,
  thresholds: SwipeThresholds = DEFAULT_SWIPE,
): SwipeDirection | null {
  const ax = Math.abs(input.dx);
  const ay = Math.abs(input.dy);
  const isHorizontal = ax >= ay;
  const major = Math.max(ax, ay);
  const minor = Math.min(ax, ay);
  const speed = Math.abs(isHorizontal ? input.vx : input.vy);
  if (major < minor * thresholds.dominance) return null;
  if (major < thresholds.minDistance && speed < thresholds.minVelocity) return null;
  return directionOf(input, isHorizontal);
}
```

A game's layout (board plus a 3-slot tray; the tray moves beside the board on wide canvases):

```ts
// apps/line-siege/src/board/layout-board.ts
'worklet';

import { fitGrid } from '@e07/game-kit/geom/board-layout.ts';

import type { LineSiegeView } from './to-view.ts';
import type { BoardLayout, Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { LayoutInput } from '@e07/shell/game-host/board-types.ts';

const PAD = 8;
const TRAY_SHARE = 0.22;
const TRAY_SLOTS = 3;

/** Board plus a 3-slot tray; tray below in portrait, beside the board when wide. Any size works. */
export function layoutBoard(input: LayoutInput<LineSiegeView>): BoardLayout {
  const isWide = input.width > input.height * 1.2;
  const inner: Rect = {
    x: PAD,
    y: PAD,
    width: input.width - 2 * PAD,
    height: input.height - 2 * PAD,
  };
  const split = isWide ? inner.width * (1 - TRAY_SHARE) : inner.height * (1 - TRAY_SHARE);
  const boardBox = isWide ? { ...inner, width: split } : { ...inner, height: split };
  const trayBox = isWide
    ? { ...inner, x: inner.x + split, width: inner.width - split }
    : { ...inner, y: inner.y + split, height: inner.height - split };
  return {
    width: input.width,
    height: input.height,
    isMirrored: input.isMirrored,
    regions: [
      { id: 'board', ...fitGrid({ box: boardBox, cols: input.view.cols, rows: input.view.rows }) },
      {
        id: 'tray',
        ...fitGrid({ box: trayBox, cols: isWide ? 1 : TRAY_SLOTS, rows: isWide ? TRAY_SLOTS : 1 }),
      },
    ],
  };
}
```

```ts
// packages/game-kit/src/geom/board-layout.test.ts
import fc from 'fast-check';

import { cellRect, fitGrid, hitTest } from './board-layout.ts';

import type { BoardLayout } from './board-layout.ts';

function gridLayout(
  size: { width: number; height: number },
  grid: { cols: number; rows: number },
  isMirrored: boolean,
): BoardLayout {
  const box = { x: 0, y: 0, width: size.width, height: size.height };
  return { ...size, isMirrored, regions: [{ id: 'board', ...fitGrid({ box, ...grid }) }] };
}

describe('board layout', () => {
  it('maps every cell centre back to the same cell at any canvas size, mirrored or not', () => {
    fc.assert(
      fc.property(
        fc.record({
          width: fc.integer({ min: 200, max: 2732 }),
          height: fc.integer({ min: 200, max: 2732 }),
        }),
        fc.record({ cols: fc.integer({ min: 3, max: 12 }), rows: fc.integer({ min: 3, max: 12 }) }),
        fc.boolean(),
        (size, grid, isMirrored) => {
          const layout = gridLayout(size, grid, isMirrored);
          for (let row = 0; row < grid.rows; row += 1) {
            for (let col = 0; col < grid.cols; col += 1) {
              const rect = cellRect(layout, { regionId: 'board', col, row });
              if (rect === null) throw new Error('missing cell');
              const centre = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
              expect(hitTest(layout, centre)).toStrictEqual({ regionId: 'board', col, row });
            }
          }
        },
      ),
      { seed: 11, numRuns: 200 },
    );
  });

  it('puts logical column 0 on the physical right edge when mirrored', () => {
    const layout = gridLayout({ width: 400, height: 400 }, { cols: 4, rows: 4 }, true);
    expect(cellRect(layout, { regionId: 'board', col: 0, row: 0 })?.x).toBe(300);
  });

  it('keeps the whole grid inside the canvas', () => {
    const region = fitGrid({ box: { x: 0, y: 0, width: 390, height: 520 }, cols: 8, rows: 8 });
    expect(region.x + region.cell * 8).toBeLessThanOrEqual(390);
    expect(region.y + region.cell * 8).toBeLessThanOrEqual(520);
  });
});
```

### 2.14 Text on boards: Paragraph, RTL, digits

- **Digits:** `toView()` formats every number with the Shell's formatter for the current locale tag (`createNumberFormatter(localeTagFor(language, digits))`, docs/10), so the view holds `'۱۲'`, not `12`. A game declares numbers that must stay Latin (codes, symbols) and formats those with the `en` tag.
- **Standalone digits and Latin:** `drawCenteredText` with `kit.numberFont`. Persian/Sorani digits need no shaping, so `drawText` is correct for them (verified on device: `۱۲` in Vazirmatn).
- **Words in Persian or Sorani:** a Paragraph built on JS, laid out once per text/size/theme, stored in `kit.labels`, drawn in the Picture with `label.paint(canvas, x, y)`. Verified on the iOS 26.5 simulator: a Paragraph captured in the kit and painted inside the Picture worklet rendered `ئاستی ۱۲ — مرحله ۱۲` correctly shaped and ordered.
- **`TextDirection.RTL === 0`** (falsy) and `LTR === 1`: never write `textDirection: isRtl && TextDirection.RTL`.
- **Fonts on device:** `const fonts = Skia.FontMgr.System()`; `fonts.matchFamilyStyle('Vazirmatn', { weight: 400, width: 5, slant: 0 })` gives the typeface for `makeBoardKit`; `Skia.ParagraphBuilder.Make({ textDirection: TextDirection.RTL, textAlign: TextAlign.Center })` without a provider resolves `fontFamilies: ['Vazirmatn']` through the same system manager. Verified on the simulator after the `expo-font` plugin embedded the TTFs (`countFamilies()` listed `Vazirmatn`).
- **Fonts in tests and Node:** `Skia.Typeface.MakeFreeTypeFaceFromData(Skia.Data.fromBytes(bytes))` from `apps/<game>/assets/fonts/Vazirmatn-Regular.ttf`, and a `Skia.TypefaceFontProvider` for paragraphs (Skia's jestSetup mocks `useFonts`/`matchFont` to `null`).

### 2.15 Particles, 120 Hz and lifecycle

```ts
// packages/game-kit/src/timeline/particles.ts
'worklet';

import { hashU32 } from '@e07/game-kit/rng/sfc32.ts';

/**
 * A particle burst is stateless: every particle's position is a pure function of
 * (burst, index, age). Nothing is stored per frame, so bursts replay identically,
 * render at any t in goldens, and cost nothing when the clock is stopped.
 */
export type BurstSpec = {
  readonly seed: number;
  readonly x: number;
  readonly y: number;
  readonly count: number;
  /** Speed range in px/s. */
  readonly minSpeed: number;
  readonly maxSpeed: number;
  /** Downward acceleration in px/s². */
  readonly gravity: number;
  readonly lifeMs: number;
};

/** One particle at one age: position in canvas points and opacity. */
export type ParticleSample = { readonly x: number; readonly y: number; readonly alpha: number };

/**
 * 16 unit vectors (cos, sin of k·22.5°), precomputed once with Node and committed as
 * literals so the kit never calls Math.cos/Math.sin (determinism policy).
 */
const DIRECTIONS = [
  1, 0, 0.9238795325112867, 0.3826834323650898, 0.7071067811865476, 0.7071067811865476,
  0.3826834323650898, 0.9238795325112867, 0, 1, -0.3826834323650898, 0.9238795325112867,
  -0.7071067811865476, 0.7071067811865476, -0.9238795325112867, 0.3826834323650898, -1, 0,
  -0.9238795325112867, -0.3826834323650898, -0.7071067811865476, -0.7071067811865476,
  -0.3826834323650898, -0.9238795325112867, 0, -1, 0.3826834323650898, -0.9238795325112867,
  0.7071067811865476, -0.7071067811865476, 0.9238795325112867, -0.3826834323650898,
] as const;
const DIRECTION_COUNT = 16;

/** Pure: particle `index` of a burst at `ageMs`; direction and speed come from hashU32. */
export function sampleParticle(burst: BurstSpec, index: number, ageMs: number): ParticleSample {
  const bits = hashU32(burst.seed, index);
  const direction = bits % DIRECTION_COUNT;
  const speedT = ((bits >>> 8) & 0xff) / 255;
  const speed = burst.minSpeed + (burst.maxSpeed - burst.minSpeed) * speedT;
  const dx = DIRECTIONS[direction * 2] ?? 0;
  const dy = DIRECTIONS[direction * 2 + 1] ?? 0;
  const t = ageMs / 1000;
  return {
    x: burst.x + dx * speed * t,
    y: burst.y + dy * speed * t + 0.5 * burst.gravity * t * t,
    alpha: Math.max(0, 1 - ageMs / burst.lifeMs),
  };
}
```

Bursts are tracks (`channel: 'burst'`), so they obey reduced motion, render at any t in goldens, and cost nothing once the clock stops.

**120 Hz.** `withShell` sets `ios.infoPlist.CADisableMinimumFrameDurationOnPhone: true` (verified in the prebuilt Info.plist). Reanimated 4.5.1 and Worklets 0.10.1 already request 120 fps from `CADisplayLink`; the plist key is the only switch. The simulator caps at 60 fps, so 120 Hz is confirmed by the owner on a ProMotion phone with the debug frame-time recorder (docs/15 section 3.2).

**Lifecycle.** One hook decides whether the board may run (the AudioContext has its own app-level hook in docs/09; both use the same foreground check):

```ts
// packages/shell/src/app/use-is-app-active.ts
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import type { AppStateStatus } from 'react-native';

/** True while the app is in the foreground ('active'); 'inactive' and 'background' are false. */
export function useIsAppActive(): boolean {
  const [appState, setAppState] = useState<AppStateStatus>(() =>
    AppState.currentState === 'active' ? 'active' : 'inactive',
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => {
      subscription.remove();
    };
  }, []);
  return appState === 'active';
}
```

```ts
// packages/shell/src/game-host/use-game-lifecycle.ts
import { useEffect, useEffectEvent } from 'react';

import { useIsAppActive } from '@e07/shell/app/use-is-app-active.ts';

export type LifecycleInput = {
  /** From React Navigation's useIsFocused() on the Game screen. */
  readonly isFocused: boolean;
  /** From the ads store: an interstitial or rewarded ad is on screen. */
  readonly isFullscreenAdShowing: boolean;
  /** Stop frame callbacks, suspend audio, cancel cues; real-time games also save and auto-pause. */
  readonly onPause: () => void;
  /** Resume audio; turn-based clocks finish the interrupted timeline; real-time stays paused (S6). */
  readonly onResume: () => void;
};

/** ONE place that decides whether the board may run: app active AND screen focused AND no ad. */
export function useGameLifecycle(input: LifecycleInput): void {
  const isAppActive = useIsAppActive();
  const isRunnable = isAppActive && input.isFocused && !input.isFullscreenAdShowing;
  const handleChange = useEffectEvent((isNowRunnable: boolean) => {
    if (isNowRunnable) input.onResume();
    else input.onPause();
  });
  useEffect(() => {
    handleChange(isRunnable);
  }, [isRunnable]);
}
```

- Background (spec S5): stop clocks and loops, cancel cues, suspend audio; real-time games save and show Pause on return; turn-based boards finish the interrupted timeline on resume (the clock sees `elapsed ≥ endMs` on its first frame and stops).
- Full-screen ads: the ads store's `isFullscreenAdShowing` stops everything the same way (ads play their own audio).
- Focus: `useIsFocused()` from React Navigation on the Game screen.
- On the first frame after (re)activation `timeSincePreviousFrame` is `null`; `planSteps` treats it as 0, so a resumed sim never jumps.
- `reloadAppAsync` (direction change, docs/10): dispose the AudioPort first (docs/09).

## 3. Building a new game on this architecture

Follow the TDD order of docs/07 rule 4 (and docs/17's per-game build order); the engine-specific steps:

1. **Classify the game** with the table in section 4 (turn-based, simulate-then-replay, or real-time) and pick its `panMode` (`none`, `swipe`, `drag`, `aim`) and input policy (`fast-forward` default, `queue` when the animation carries information the player needs before the next move).
2. **State and events** in `apps/<game>/src/rules/<game>-types.ts`: JSON-serialisable state with the `RngState` inside; events in past tense with every id and from/to value the animation needs (`'column-cleared'`, `'monster-moved'`).
3. **Engine functions** (`create`, `listMoves`, `applyMove`, `outcome`, `intentToMove`) test-first, with fast-check properties (same seed ⇒ same state; `applyMove` never produces an illegal state; `listMoves` is empty exactly when `outcome` is not `playing`).
4. **Bot** with `playBot` and a `*.sim.test.ts` that plays thousands of seeded games (winnability, difficulty curve, no infinite games):

```ts
// packages/game-kit/src/testing/play-bot.ts
import { nextInt, seedRng } from '@e07/game-kit/rng/sfc32.ts';

import type { GameEngine, Outcome } from '@e07/game-kit/contract/game-engine.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

/** A bot picks one of the legal moves. It gets its own seeded RNG, never Math.random. */
export type BotPolicy<TState, TMove> = (
  state: TState,
  moves: readonly TMove[],
  rng: RngState,
) => { readonly move: TMove; readonly rng: RngState };

/** The engine subset a bot needs; any GameModule satisfies it. */
export type BotGame<TState, TMove, TEvent> = Pick<
  GameEngine<TState, TMove, TEvent>,
  'create' | 'listMoves' | 'applyMove' | 'outcome'
>;

/** How one bot game ended and after how many moves. */
export type BotRun = { readonly outcome: Outcome; readonly moves: number };

/** Seed, difficulty, policy and a hard move cap (a stuck bot must end, not hang). */
export type BotOptions<TState, TMove> = {
  readonly seed: number;
  readonly difficulty: number;
  readonly policy: BotPolicy<TState, TMove>;
  readonly maxMoves: number;
};

/** Uniformly random legal move; the baseline for winnability and difficulty curves. */
export function randomPolicy<TState, TMove>(): BotPolicy<TState, TMove> {
  return (_state, moves, rng) => {
    const draw = nextInt(rng, moves.length);
    const move = moves[draw.value];
    if (move === undefined) throw new Error('randomPolicy called without legal moves');
    return { move, rng: draw.state };
  };
}

/** Plays one game headless. Same seed + same policy = same game, on every machine. */
export function playBot<TState, TMove, TEvent>(
  game: BotGame<TState, TMove, TEvent>,
  options: BotOptions<TState, TMove>,
): BotRun {
  let state = game.create(options.seed, options.difficulty);
  let rng = seedRng(options.seed ^ 0x5bd1e995);
  for (let played = 0; played < options.maxMoves; played += 1) {
    const outcome = game.outcome(state);
    const moves = game.listMoves(state);
    if (outcome.kind !== 'playing' || moves.length === 0) return { outcome, moves: played };
    const choice = options.policy(state, moves, rng);
    rng = choice.rng;
    state = game.applyMove(state, choice.move).state;
  }
  return { outcome: game.outcome(state), moves: options.maxMoves };
}
```

5. **View** (`to-view.ts`): flat numbers and strings, digits localised, nothing Skia.
6. **Timeline** (`build-timeline.ts`) with tests: budget per turn (e.g. ≤ 1200 ms), reduced motion has no particles and no overshoot, cues present.
7. **Palette** (`board-palettes.json` + a 5-line `board-palettes.ts`: light, dark, colour-blind light/dark; docs/09) and **paths** (`buildPaths` with `PathBuilder`, unit size).
8. **Layout** (`layout-board.ts`, `'worklet'`) with the any-size property test from 2.13.
9. **Draw** (`draw-board.ts`, `'worklet'`), one small function per layer (background, cells, entities, effects, ghost); a draw-call budget test; pixel goldens in `test/goldens/boards/` at three sizes × {0, 50 %, 100 %} (they read the font with `node:fs`, which docs/04 bans under `apps/*/src`):

```ts
// apps/line-siege/src/board/draw-board.test.ts
import { sampleTimeline } from '@e07/game-kit/timeline/sample.ts';
import { IDLE_POINTER } from '@e07/shell/game-host/board-types.ts';

import { buildTimeline } from './build-timeline.ts';
import { drawBoard } from './draw-board.ts';
import { layoutBoard } from './layout-board.ts';

import type { BoardToken } from './board-palettes.ts';
import type { LineSiegeView } from './to-view.ts';
import type { BoardColors, RenderKit } from '@e07/shell/game-host/board-types.ts';
import type { SkCanvas, SkColor, SkFont, SkPaint } from '@shopify/react-native-skia';

type Recorded = { readonly calls: Map<string, number>; readonly texts: string[] };

/** Counts every canvas call (a headless proxy for draw calls per frame) and keeps drawText strings. */
function recordingCanvas(): { canvas: SkCanvas; recorded: Recorded } {
  const recorded: Recorded = { calls: new Map(), texts: [] };
  const canvas = new Proxy(
    {},
    {
      get:
        (_target, name) =>
        (...args: unknown[]) => {
          recorded.calls.set(String(name), (recorded.calls.get(String(name)) ?? 0) + 1);
          if (name === 'drawText' && typeof args[0] === 'string') recorded.texts.push(args[0]);
        },
    },
  ) as SkCanvas;
  return { canvas, recorded };
}

const stubFont = { getGlyphIDs: () => [1, 2], getGlyphWidths: () => [8, 8] } as unknown as SkFont;

const stubPaint = new Proxy({}, { get: () => () => undefined }) as SkPaint;
const KIT: RenderKit = {
  fill: stubPaint,
  stroke: stubPaint,
  numberFont: stubFont,
  paths: {},
  labels: {},
};
const COLOR = new Float32Array([0, 0, 0, 1]) as SkColor;
const COLORS: BoardColors<BoardToken> = {
  scheme: 'dark',
  isColorBlind: false,
  color: {
    background: COLOR,
    cell: COLOR,
    block: COLOR,
    beam: COLOR,
    monster: COLOR,
    number: COLOR,
    ghost: COLOR,
  },
};
const VIEW: LineSiegeView = {
  cols: 8,
  rows: 8,
  cells: Array.from({ length: 64 }, (_, i) => (i % 3 === 0 ? 1 : 0)),
  monsters: [{ id: 1, col: 2, row: 1, hpText: '8' }],
};

describe('drawBoard', () => {
  it('stays within 200 canvas calls on the busiest frame of a turn', () => {
    const tracks = buildTimeline([{ kind: 'column-cleared', col: 3 }], 'full');
    const fx = { ...sampleTimeline(tracks, 300), pointer: IDLE_POINTER };
    const layout = layoutBoard({ width: 390, height: 560, view: VIEW, isMirrored: false });
    const { canvas, recorded } = recordingCanvas();
    drawBoard(canvas, { view: VIEW, fx, colors: COLORS, layout, kit: KIT });
    const total = [...recorded.calls.values()].reduce((sum, n) => sum + n, 0);
    expect(recorded.calls.get('drawCircle')).toBeGreaterThan(1);
    expect(total).toBeLessThanOrEqual(200);
  });

  it('draws the localised HP label that a 0.1 % pixel golden could miss', () => {
    const view = { ...VIEW, monsters: [{ id: 1, col: 2, row: 1, hpText: '۱۲' }] };
    const fx = { ...sampleTimeline([], 0), pointer: IDLE_POINTER };
    const layout = layoutBoard({ width: 390, height: 560, view, isMirrored: false });
    const { canvas, recorded } = recordingCanvas();
    drawBoard(canvas, { view, fx, colors: COLORS, layout, kit: KIT });
    expect(recorded.texts).toStrictEqual(['۱۲']);
  });
});
```

```ts
// test/goldens/boards/line-siege-board.golden.test.ts
// PIXEL GOLDEN (Jest 'golden' project, CanvasKit). It reads the font with node:fs, so it lives
// under test/ (docs/07 rule 7); tolerance and diff folder come from docs/07's skia-golden.ts.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Skia } from '@shopify/react-native-skia';

import { timelineEndMs } from '@e07/game-kit/timeline/track.ts';
import { BOARD_PALETTES } from '@e07/line-siege/board/board-palettes.ts';
import { buildTimeline } from '@e07/line-siege/board/build-timeline.ts';
import { drawBoard } from '@e07/line-siege/board/draw-board.ts';
import { layoutBoard } from '@e07/line-siege/board/layout-board.ts';
import { makeBoardColors, makeBoardKit } from '@e07/shell/game-host/board-kit.ts';
import { paintBoardPng } from '@e07/shell/game-host/paint-board-png.ts';

import { toMatchPixelGolden } from './skia-golden.ts';

import type { LineSiegeView } from '@e07/line-siege/board/to-view.ts';

expect.extend({ toMatchImageSnapshot: toMatchPixelGolden });

/** Skia's jestSetup mocks useFonts/matchFont: load the app's bundled TTF explicitly (docs/10). */
const FONT = join(process.cwd(), 'apps/line-siege/assets/fonts/Vazirmatn-Regular.ttf');
const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(
  Skia.Data.fromBytes(new Uint8Array(readFileSync(FONT))),
);
const KIT = makeBoardKit(Skia, { paths: {}, numberTypeface: typeface, numberSize: 16 });
const COLORS = makeBoardColors(Skia, BOARD_PALETTES, { scheme: 'dark', isColorBlind: false });
const VIEW: LineSiegeView = {
  cols: 8,
  rows: 8,
  cells: Array.from({ length: 64 }, (_, i) => (i % 8 === 3 || i % 11 === 0 ? 1 : 0)),
  monsters: [{ id: 1, col: 5, row: 1, hpText: '۱۲' }],
};
const TRACKS = buildTimeline([{ kind: 'column-cleared', col: 3 }], 'full');
const SIZES = [
  { name: 'phone-portrait', width: 390, height: 560 },
  { name: 'tablet-landscape', width: 1024, height: 700 },
  { name: 'small', width: 320, height: 400 },
] as const;
const MOMENTS = [0, 0.5, 1] as const;

describe('line siege board goldens', () => {
  it.each(SIZES.flatMap((size) => MOMENTS.map((moment) => ({ ...size, moment }))))(
    'renders $name at $moment of a column clear',
    ({ width, height, moment, name }) => {
      const png = paintBoardPng(Skia, {
        draw: drawBoard,
        layout: layoutBoard,
        view: VIEW,
        tracks: TRACKS,
        elapsedMs: timelineEndMs(TRACKS) * moment,
        colors: COLORS,
        kit: KIT,
        width,
        height,
        isMirrored: false,
      });
      expect(Buffer.from(png)).toMatchImageSnapshot({
        customSnapshotIdentifier: `line-siege-${name}-${String(moment)}`,
      });
    },
  );
});
```

10. **Board object** (`<game>-board.ts`) with `isMirroredInRtl`, `describe` (a catalog key in the game's four catalogs), and put it in `presentation.board` of the game's `ShellGameModule<Types>` exported from `apps/<game>/src/index.ts` (docs/02).
11. **Real-time only:** `apps/<game>/src/sim/` with `'worklet'`, typed arrays, integer commands, event triples, a replay test and a frame-grouping test (2.7).
12. **Run** `npm run check:fast`, then `npm test` (unit + golden), `npm run test:sim`, then a Release simulator build and look at the board in all four languages (the screenshot matrix, docs/07 section 3.13). Read the golden PNGs with the Read tool before accepting them (`jest -u` + `Gate-Change:` trailer).

## 4. The catalogue on this architecture (spec section 13)

| # | Game | Class | Input (`panMode`) | Special needs |
|---|---|---|---|---|
| 1 | Line Siege (pilot) | turn-based | tap block + tap cell; drag tray → board (`drag`) | beams, particles, damage numbers in local digits; ghost one cell above the finger; tray region in the layout |
| 2 | Flock Tilt | turn-based | 4-way swipe (`swipe`), undo | all sheep slide together: one `pos` track per sheep; solver for par |
| 3 | Scrap Shove | turn-based | tap adjacent cell | robot crash events; shake and particles (reduced-motion aware) |
| 4 | Snare Snake | turn-based | swipe or tap direction (`swipe`) | loop-capture highlight track |
| 5 | Merge Siege | turn-based | swipe (`swipe`) | slide + merge tweens; marching enemies as `row` tracks |
| 6 | Jump Chain | turn-based | tap piece, tap or drag target (`drag`) | multi-jump chain: several sequential `pos` tracks on one entity (the sampler follows the latest started) |
| 7 | Stepstone | turn-based | tap | reachable-cell highlights computed by `listMoves` |
| 8 | Swap Guard | turn-based | tap | telegraph overlays for enemy intents |
| 9 | Toggle Drop | simulate-then-replay | tap column | ball path through flip-flops computed in `applyMove` (discrete, no physics); toggles as tracks |
| 10 | Poker Drop | turn-based + replayed cascades | tap column | card faces drawn in code (unit paths + digits/letters); cascade timeline with chained delays |
| 11 | Trail Clear | turn-based | tap or drag tile (`drag`) | closed-loop detection in rules; loop highlight |
| 12 | Dig Site | turn-based | tap; long-press to flag | `Exclusive(pan, longPress, tap)`; numbers in local digits |
| 13 | Floodline | turn-based | tap; long-press | flood spread as timed tracks per cell |
| 14 | Sonar Hand | turn-based | drag probe shapes (`drag`) | ghost shape preview via `pointer`; legality preview via `onHover` |
| 15 | Deep Sweep | turn-based | tap; long-press | collapsing rows as tracks |
| 16 | Grove Shift | turn-based | drag along a row or column (`drag` or `swipe`) | wrap-around tween (draw the wrapped copy at both ends) |
| 17 | Rank Ladder | turn-based | tap cards | card rendering shared with Poker Drop (move to game-kit only when two games use it) |
| 18 | Letter Bugs | turn-based | drag a path through letters (`drag`) | **dictionaries:** one word list per language as `.json` (docs/04 rule 8), normalised (Arabic ي→ی and ك→ک, ZWNJ handling, Sorani letters ڕ ڵ ۆ ێ ە ڤ) by a pure tested `normalizeWord`; licences recorded in S11d. **Mirrored board:** `isMirroredInRtl: true`, so in fa/ckb column 0 sits on the right and the path reads right-to-left; letters are Paragraph labels cached per letter in `kit.labels`; the formed word is one RTL Paragraph |
| 19 | Exact Zero | turn-based | tap cards | card set and balance via bots |
| 20 | Dice Foundry | turn-based | drag dice (`drag`) | pip faces as unit paths |
| 21 | Fuseban | turn-based (timers count turns) | tap or swipe | blast pushes as events; never wall-clock timers |
| 22 | Ripple Ten | turn-based | tap; drag-select rectangle (`drag`) | selection rectangle from `pointer` |
| 23 | Dock Slide | turn-based | swipe (`swipe`) | slide-merge tweens |
| 24 | Last Stop | turn-based | drag passenger → seat (`drag`) | seat regions as extra `GridRegion`s |
| 25 | Bank Shot | simulate-then-replay | aim drag, release (`aim`) | geom kit (swept circle vs segments, `reflect`); volley computed in `applyMove`; many balls → `<Atlas>` |
| 26 | Halo Drift | **real-time** | one-thumb stick: pan anywhere → integer direction command | UI-thread fixed-step loop (2.7), circle overlap + spatial hash, `<Atlas>` + pre-rendered sprites, save points at wave end / pause / background, owner play-test for feel |

Only Bank Shot (collision kit + replay) and Halo Drift (UI-thread loop) need more than the turn-based stack; neither needs a physics engine (FINAL B.17).

## 5. Testing hooks

| Hook | Where | What it proves |
|---|---|---|
| Engine unit tests + fast-check properties | `apps/<game>/src/rules/*.test.ts` | rules, determinism, invariants |
| Bots | `playBot` in `*.sim.test.ts` (`npm run test:sim`, `jest.sim.config.js`, docs/07) | winnability, difficulty curve, termination |
| Timeline tests | `build-timeline.test.ts` | budget, reduced motion, cues |
| Clock test with fake timestamps | `board-scene.test.ts` | the `startAt` fix survives stop/restart |
| Gesture tests (`fireGestureHandler` + `withTestId`) | `use-board-gestures.test.tsx` | tap → cell, drag → exactly one intent |
| Layout property | `board-layout.test.ts` | hit-test ∘ cellRect = identity at any size, mirrored or not |
| Draw-call budget + text assertions | `draw-board.test.ts` | per-frame cost; localised labels drawn |
| Pixel goldens (CanvasKit, 0.1 %) | `test/goldens/boards/*.golden.test.ts` → `__image_snapshots__/` | visual regressions at 3 sizes × 3 moments |
| Replay + frame-grouping | `apps/<game>/src/sim/*.test.ts` | real-time determinism |
| Worklet boundary | `check-worklet-boundary.test.ts` | no JS-only import on the UI thread |
| Simulator | Release build, `xcrun simctl io … screenshot` | Metal rendering, fonts, real timing |

Gesture tests need `act()`: the Worklets Jest mock delivers `scheduleOnRN` as a microtask.

```tsx
// packages/shell/src/game-host/use-board-gestures.test.tsx
import { act, render } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { BoardGestureProbe } from './board-gesture-probe.tsx';

import type { BoardLayout } from '@e07/game-kit/geom/board-layout.ts';

const LAYOUT: BoardLayout = {
  width: 400,
  height: 400,
  isMirrored: false,
  regions: [{ id: 'board', x: 0, y: 0, cell: 50, cols: 8, rows: 8 }],
};

describe('useBoardGestures', () => {
  it('turns a tap into a tap intent on the hit cell', async () => {
    const onIntent = jest.fn();
    await render(<BoardGestureProbe layout={LAYOUT} panMode="drag" onIntent={onIntent} />);
    // scheduleOnRN is a microtask in the worklets Jest mock: act() flushes it.
    await act(() => {
      fireGestureHandler(getByGestureTestId('board.tap'), [
        { state: State.BEGAN, x: 175, y: 60 },
        { state: State.ACTIVE, x: 175, y: 60 },
        { state: State.END, x: 175, y: 60 },
      ]);
    });
    expect(onIntent).toHaveBeenCalledWith({
      kind: 'tap',
      target: { regionId: 'board', col: 3, row: 1 },
    });
  });

  it('turns a drag into ONE drag-end intent from the start cell to the release cell', async () => {
    const onIntent = jest.fn();
    await render(<BoardGestureProbe layout={LAYOUT} panMode="drag" onIntent={onIntent} />);
    await act(() => {
      fireGestureHandler(getByGestureTestId('board.pan'), [
        { state: State.BEGAN, x: 25, y: 25, translationX: 0, translationY: 0 },
        { state: State.ACTIVE, x: 40, y: 25, translationX: 15, translationY: 0 },
        { state: State.ACTIVE, x: 125, y: 175, translationX: 100, translationY: 150 },
        {
          state: State.END,
          x: 125,
          y: 175,
          translationX: 100,
          translationY: 150,
          velocityX: 0,
          velocityY: 0,
        },
      ]);
    });
    expect(onIntent).toHaveBeenCalledTimes(1);
    expect(onIntent).toHaveBeenCalledWith({
      kind: 'drag-end',
      from: { regionId: 'board', col: 0, row: 0 },
      to: { regionId: 'board', col: 2, row: 3 },
    });
  });
});
```

```ts
// packages/shell/src/game-host/board-scene.test.ts

import { NOT_STARTED, makeScene, sceneElapsedMs, tickClock } from './board-scene.ts';

import type { BoardScene } from './board-scene.ts';
import type { Track } from '@e07/game-kit/timeline/track.ts';

const TRACK: Track = {
  channel: 'pos',
  entityId: 1,
  startMs: 0,
  durationMs: 300,
  easing: 'linear',
  from: [0],
  to: [1],
};

/** Mimics the frame callback: first frame stamps startAt, later frames measure from it. */
function runFrames(
  scene: BoardScene<string>,
  timestamps: readonly number[],
): { scene: BoardScene<string>; elapsed: number[] } {
  let current = scene;
  const elapsed: number[] = [];
  for (const timestamp of timestamps) {
    const tick = tickClock(current, timestamp);
    if (current.startAt === NOT_STARTED) current = { ...current, startAt: tick.startAt };
    elapsed.push(tick.elapsedMs);
  }
  return { scene: current, elapsed };
}

describe('frame clock', () => {
  it('starts every pushed scene at elapsed 0, even after the callback was stopped and restarted', () => {
    const first = runFrames(makeScene(1, 'a', [TRACK]), [1000, 1016, 1320]);
    expect(first.elapsed).toStrictEqual([0, 16, 320]);
    const second = runFrames(makeScene(2, 'b', [TRACK]), [9000, 9016]);
    expect(second.elapsed).toStrictEqual([0, 16]);
  });

  it('reports done once elapsed reaches the last track end', () => {
    const scene = { ...makeScene(1, 'a', [TRACK]), startAt: 1000 };
    expect(tickClock(scene, 1299).isDone).toBe(false);
    expect(tickClock(scene, 1300).isDone).toBe(true);
  });

  it('draws a just-pushed scene at its first frame', () => {
    expect(sceneElapsedMs(makeScene(3, 'c', [TRACK]), 123456)).toBe(0);
  });
});
```

Golden mechanics (docs/07 owns the Jest config and `test/goldens/boards/skia-golden.ts`, whose `toMatchPixelGolden` fixes the 0.1 % tolerance and the diff folder): the `golden` project uses `testEnvironment: '@shopify/react-native-skia/jestEnv.js'` and `setupFilesAfterEnv: ['@shopify/react-native-skia/jestSetup.js']`; the `unit` project keeps jest-expo's environment (Skia's env replaces React Native's export conditions, so it must not be global). `jest --ci` never writes a new golden; create or change goldens only with `jest -u` and a `Gate-Change:` trailer (`__image_snapshots__/**` is a gated path, docs/16). Rendering for goldens goes through the same `draw()`:

```ts
// packages/shell/src/game-host/paint-board-png.ts
// Offscreen render of the SAME draw() the device runs. Used by golden tests (Jest, CanvasKit)
// and by the Node art scripts (headless Skia). Takes the Skia API as a parameter.
import { sampleTimeline } from '@e07/game-kit/timeline/sample.ts';

import { IDLE_POINTER } from './board-types.ts';

import type { BoardColors, DrawFrame, LayoutInput, RenderKit, SkiaApi } from './board-types.ts';
import type { BoardLayout } from '@e07/game-kit/geom/board-layout.ts';
import type { Track } from '@e07/game-kit/timeline/track.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

export type PngRequest<TView, TToken extends string> = {
  readonly draw: (canvas: SkCanvas, frame: DrawFrame<TView, TToken>) => void;
  readonly layout: (input: LayoutInput<TView>) => BoardLayout;
  readonly view: TView;
  readonly tracks: readonly Track[];
  readonly elapsedMs: number;
  readonly colors: BoardColors<TToken>;
  readonly kit: RenderKit;
  readonly width: number;
  readonly height: number;
  readonly isMirrored: boolean;
};

export function paintBoardPng<TView, TToken extends string>(
  skia: SkiaApi,
  request: PngRequest<TView, TToken>,
): Uint8Array {
  const surface = skia.Surface.Make(request.width, request.height);
  if (surface === null) throw new Error('Offscreen surface unavailable');
  const { width, height, view, isMirrored } = request;
  request.draw(surface.getCanvas(), {
    view,
    fx: { ...sampleTimeline(request.tracks, request.elapsedMs), pointer: IDLE_POINTER },
    colors: request.colors,
    layout: request.layout({ width, height, view, isMirrored }),
    kit: request.kit,
  });
  surface.flush();
  return surface.makeImageSnapshot().encodeToBytes();
}
```

E2E: the canvas has no accessibility children, so Maestro taps boards by coordinates computed from the same `BoardLayout`. In test builds, when the debug deep link sets `boardLayout=1`, `game-board-host.tsx` must render one small `AppText` with testID `game.board-layout` whose text is `JSON.stringify({ x, y, layout })`: the canvas origin in window points (`measureInWindow` on `game.board`) and the current `BoardLayout`. docs/07 section 3.12 defines the contract and the tap maths; the rendering code is still to be written (docs/07 open issue 7).

## 6. API churn: what training data gets wrong

| Area | Wrong (old) | Right (SDK 57 stack) |
|---|---|---|
| Skia paths | `const p = Skia.Path.Make(); p.addCircle(…)` (mutable) | `Skia.PathBuilder.Make().moveTo().lineTo().close().build()`, `Skia.Path.Circle(x, y, r)`; in 2.6.2 `path.transform(m)` still mutates in place (deprecated), so transform a copy with `Skia.PathBuilder.MakeFromPath(path).transform(m).build()` or draw with `canvas.scale/translate` |
| Skia text width | `font.measureText(t).width` | glyph widths (`draw-centered-text.ts`); `measureText` is unimplemented in CanvasKit |
| Skia canvas size | `<Canvas onLayout>` | `<Canvas onSize={sharedValue}>` or `useCanvasSize()` (`onLayout` is deprecated on Fabric) |
| Skia colours | Reanimated `interpolateColor` | Skia `interpolateColors` (different colour format) |
| Skia text direction | `textDirection: TextDirection.RTL \|\| …` | `TextDirection.RTL === 0` is falsy; compare explicitly |
| Worklets → JS | `runOnJS(fn)(args)` | `scheduleOnRN(fn, ...args)`; `scheduleOnUI` replaces `runOnUI` |
| Shared values | `sv.value = x` | `sv.set(x)`, `sv.get()`; in-place: mutate on UI then `sv.modify()` |
| Frame time | `timeSinceFirstFrame` for animation time | `timestamp` + `startAt` sentinel (rule 5) |
| Reduced motion | `useReducedMotion()` for live changes | it is read once at module load; the Shell setting (defaulting to `AccessibilityInfo`) is passed to `buildTimeline` |
| RNGH v3 (SDK 58: ~3.2.1) | `Gesture.Tap().onEnd((e, success) => …)` | `useTapGesture({ onDeactivate: (e) => { if (e.canceled) return; … } })`; `onStart→onActivate`, `onEnd→onDeactivate`, `onChange` merged into `onUpdate`, `Gesture.Exclusive→useExclusiveGestures`; the builder types are renamed `LegacyExclusiveGesture`, `LegacyTapGesture`…; v3 still exports the deprecated builder, but hook and builder gestures cannot be related, so migrate `use-board-gestures.ts` as a whole. *Source:* [RNGH upgrading to 3](https://docs.swmansion.com/react-native-gesture-handler/docs/guides/upgrading-to-3) |
| Worklets Bundle Mode | import any library inside worklets | not enabled; keep UI-thread code self-contained |
| Skia install scripts | nothing to approve | Skia 2.6.2 has a postinstall that copies iOS xcframeworks: `npm approve-scripts @shopify/react-native-skia` (removed in Skia 2.6.5+, i.e. goes away with SDK 58) |

## Checklist

- [ ] Engine functions are pure, in `rules/`, and pass determinism properties; no `Math.random`, `Date`, `performance`, `Intl`, transcendental `Math.*` or `**` in deterministic folders (`npm run lint`).
- [ ] Every UI-thread file starts with `// <path>` then `'worklet';`; `check-worklet-boundary.test.ts` passes.
- [ ] `draw()` allocates no Skia objects per frame; paths are built once with `PathBuilder`; the draw-call budget test passes and asserts every localised label.
- [ ] Goldens exist at 3 sizes × {0, 50 %, 100 %}, were looked at, and pass with `CI=1 npm run test:golden`.
- [ ] The board clock stops itself (debug frame counter shows frames only while animating); background, ads and blur stop all callbacks and suspend audio.
- [ ] Moves are saved before `presentMove`; fast-forward cancels old cues; `queue` games wait for `isSceneAnimating(...) === false`.
- [ ] Gestures go only through `useBoardGestures`; each gesture yields at most one intent (gesture tests).
- [ ] Layout property test passes, mirrored and not; the board is checked on iPad landscape in the screenshot matrix.
- [ ] Arabic-script text uses Paragraph labels; digits come localised from `toView`; fonts come from `Skia.FontMgr.System()` on device.
- [ ] Real-time: integer commands, `(tick, command)` recording, replay and frame-grouping tests, save points outside the frame loop.
- [ ] Reduced motion removes particles, shake and overshoot; the canvas has a translated `accessibilityLabel`.
- [ ] `npx expo install --check` passes; no engine library is off the SDK pin.

## Sources

- Skia: [rendering modes](https://shopify.github.io/react-native-skia/docs/canvas/rendering-modes) · [Paragraph](https://shopify.github.io/react-native-skia/docs/text/paragraph) · [Atlas](https://shopify.github.io/react-native-skia/docs/shapes/atlas) · [headless](https://shopify.github.io/react-native-skia/docs/getting-started/headless) · [path migration](https://raw.githubusercontent.com/Shopify/react-native-skia/main/apps/docs/docs/shapes/path-migration.md)
- Expo SDK 57 pins: https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo/bundledNativeModules.json · React Compiler: https://docs.expo.dev/guides/react-compiler/
- Reanimated `useFrameCallback`: https://docs.swmansion.com/react-native-reanimated/docs/advanced/useFrameCallback/ · registry source (4.5.1): https://github.com/software-mansion/react-native-reanimated/blob/4.5.1/packages/react-native-reanimated/src/frameCallback/FrameCallbackRegistryUI.ts
- Worklets: [scheduleOnRN](https://docs.swmansion.com/react-native-worklets/docs/threading/scheduleOnRN) · [closures](https://docs.swmansion.com/react-native-worklets/docs/fundamentals/closures) · [plugin, whole-file workletization](https://raw.githubusercontent.com/software-mansion/react-native-reanimated/main/docs/docs-worklets/docs/worklets-plugin/about.md) · [Bundle Mode](https://docs.swmansion.com/react-native-worklets/docs/bundleMode)
- Gesture Handler: [upgrading to 3](https://docs.swmansion.com/react-native-gesture-handler/docs/guides/upgrading-to-3) · [testing](https://docs.swmansion.com/react-native-gesture-handler/docs/guides/testing)
- Determinism: [Hermes MathStdFunctions.def](https://github.com/facebook/hermes/blob/main/lib/VM/JSLib/MathStdFunctions.def) · [ECMA-262 Math](https://tc39.es/ecma262/#sec-function-properties-of-the-math-object)
- PRNG: https://pracrand.sourceforge.net/RNG_engines.txt · https://github.com/bryc/code/blob/master/jshash/PRNGs.md
- 120 Hz: https://developer.apple.com/documentation/bundleresources/information-property-list/cadisableminimumframedurationonphone
- React `useEffectEvent`: https://react.dev/reference/react/useEffectEvent
- jest-image-snapshot: https://github.com/americanexpress/jest-image-snapshot
- planck: https://www.npmjs.com/package/planck

## Verified (2026-09-26)

Versions: Expo 57.0.25, React Native 0.86.3, React 19.2.3, `@shopify/react-native-skia` 2.6.2 (npm latest 2.13.0), `react-native-reanimated` 4.5.1 (latest 4.7.0), `react-native-worklets` 0.10.1 (latest 0.13.0), `react-native-gesture-handler` 2.32.0 (latest 3.3.0), TypeScript 6.0.3, ESLint 9.39.5 + the docs/04 rule set, Jest 29.7 + jest-expo 57.0.5, jest-image-snapshot 6.5.2, fast-check 4.10.2, Node 26.4.0, Xcode 26.6, iOS 26.5 simulator. SDK 57 pins re-read from `bundledNativeModules.json` today.

In a copy of the verified probe (`scratchpad/rn/writer-08-09/ws`), every file in this doc:

- type-checked with the FINAL A.3 flags (`tsc --noEmit`, app world and tooling world), linted with `--max-warnings 0` against docs/04's complete `eslint.config.mjs` (plus docs/02's proposed app-zone block for `apps/**`), and was formatted by Prettier 3.9.9;
- passed the shared Jest suite (61 tests with docs/09: 50 unit, 11 golden): unit (rng goldens and properties, timeline, clock with stop/restart, layout property at any size, swipe/sweep geometry, bot harness, presenter, cues, gestures via `fireGestureHandler`, draw-call budget and label assertion, sim replay and frame grouping, worklet boundary) and CanvasKit goldens (3 sizes × 3 moments, reviewed visually, plus the docs/09 sprite sheet);
- compiled with `babel-preset-expo` 57.0.13: file-level `'worklet'` produced one worklet per top-level function; React Compiler memoised all hooks after moving frame bodies into runners (it bailed out with "value blocks within a try/catch" before).

On the iOS 26.5 simulator (Release, arm64, React Compiler on), a spike app using these modules showed: 8 consecutive animated scenes each starting at elapsed 0 after stop/restart and stopping itself (`frames=45` for a 720 ms timeline at the 60 fps cap); particles, beams and hold-before-start monster moves; `drawText` of `۱۲` and a shaped RTL Paragraph painted inside the Picture worklet; `Skia.FontMgr.System()` listing `Vazirmatn` after the `expo-font` plugin embedded it; plain-object rects accepted by the native canvas; the fixed-step loop with typed arrays in a shared value mutated in place (`sim.modify()`), 31 entities, events delivered to JS, 115.9 ticks/s steady (that spike's sim advanced its RNG words in place; the published `drawU32` variant, which satisfies docs/04 outside `sim/`, is verified in Jest). The simulator was created for the run and deleted afterwards.

**Re-verified by the reviewer (2026-09-26)** in `scratchpad/rn/verify-game`: every block of this doc, after the fixes below, passes `tsc` (both worlds), docs/04's own `eslint.config.mjs` plus docs/02's app-zone block, and Prettier; Jest ran 21 suites / 61 tests with the moved pixel goldens matching their baselines under `jest --ci`; React Compiler reported `CompileSuccess` for every hook and `BoardCanvas`. Fixes: import order and a boolean parameter name (docs/04), the recorder created per canvas instead of at import (docs/04 rule 17), the pixel golden moved to `test/goldens/boards/` (docs/07 rule 7), the rules type file renamed `line-siege-types.ts` (docs/02, docs/07), and the checker's CLI block removed. Library facts were re-read in the installed sources (Reanimated `FrameCallbackRegistryUI.ts` and `mutables.ts`, Worklets `threads.native.ts` and mock, Skia 2.6.2 `JsiSkPath`/`JsiSkFont`/`Canvas.tsx`, RNGH 3.2.1 types and upgrade guide) and on npm.

**Re-verify when versions move:** `npx expo install --check` in every app; `npm view @shopify/react-native-skia version` (and reanimated, worklets, gesture-handler); re-read the Reanimated `FrameCallbackRegistryUI.ts` of the new version (does `timeSinceFirstFrame` still reset?); re-run `npm test` (goldens will shift with a new Skia; review and re-accept with `Gate-Change:`); on SDK 58 migrate `use-board-gestures.ts` to RNGH v3 hooks in one commit and rerun the gesture tests.

## Open issues

1. **`draw` has five inputs in FINAL B.12, docs/04 allows three parameters.** Kept FINAL's inputs and order, grouped as `draw(canvas, frame: DrawFrame)` with `frame = { view, fx, colors, layout, kit }` (`kit` = pre-built Skia objects). docs/02's `ShellGameModule<T>` binds exactly this `GameBoard` (resolved).
2. **Resolved by docs/02:** `GameModule` is generic over its presentation, and `ShellGameModule<T>` binds `presentation.board` to this doc's `GameBoard` (game-kit still names no Skia type).
3. **Golden tolerance vs small text.** FINAL D.38's 0.1 % tolerance cannot see a missing two-digit label (measured 77 of 218,400 pixels = 0.035 % on a 390×560 board). This doc keeps 0.1 % and adds recording-canvas assertions for every label; alternatively docs/07's `skia-golden.ts` could use a pixel-count threshold for text-bearing goldens.
4. **Resolved: `no-param-reassign` and typed-array scratch buffers in game-kit.** docs/04 rule 14 and its exemption block now cover `packages/game-kit/src/geom/spatial-hash.ts` next to `apps/*/src/sim/**`.
5. **Tick rate on the simulator was 115.9/s, not 120/s** (steady state over 8 s, 31 entities, 60 fps display). Gameplay is unaffected (it counts ticks), but real-time speed on a device must be checked by the owner with the frame-time recorder; if a device also runs slow, compare `FrameInfo.timestamp` deltas with wall time before changing `planSteps`.
6. **Letter Bugs word lists** for fa and ckb: source and licence are an owner decision (many open dictionaries are GPL/LGPL/MPL, which the licence allowlist in FINAL D.43 rejects). Build Letter Bugs late, as the spec says.
7. **Swipe (24 pt / 600 pt/s / 1.2) and long-press (450 ms) thresholds** are unvalidated starting values.
8. **Resolved: docs/07's older sketches are gone.** docs/07 now points to this doc's `sfc32.ts`, `play-bot.ts`, `board-scene.ts` and `check-worklet-boundary.ts`; the `seedRng(1)` golden values here are the compatibility contract. `board-scene.test.ts` is one file holding this doc's section 5 cases and docs/07 section 3.8.8's fake-`FrameInfo` cases.
