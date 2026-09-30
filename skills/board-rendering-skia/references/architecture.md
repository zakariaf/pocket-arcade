# Board architecture: layers, files and the GameBoard contract

How a Pocket Arcade board is drawn, which file does what, and what a game must provide. Read this first when building the Shell's game host or a game's board.

## Contents

- Why no game engine
- Layers and data flow
- Where the code lives (and which skill owns it)
- The GameBoard contract
- Three kinds of boards
- Drawing needs across the catalogue
- Prerequisites in the app repo

## Why no game engine

There is no Unity, Godot or Phaser. Each brings a second language or runtime, an editor that needs a person at the mouse, a large binary, and none of them can be tested headlessly. The games are small 2D boards, so they are drawn with the same libraries the app already uses:

| Job | Library (Expo SDK 57 pin) | Why |
|---|---|---|
| Drawing the board | `@shopify/react-native-skia` 2.6.2 | GPU 2D; the same draw code renders PNGs in Jest and Node without a phone |
| Timing (60/120 Hz tick) | `react-native-reanimated` 4.5.1 + `react-native-worklets` 0.10.1 | Frame code runs on the UI thread, so a busy JS thread never stutters the board |
| Touch | `react-native-gesture-handler` ~2.32.0 | Board-local coordinates (the `board-gestures-and-input` skill) |
| Game-specific pieces | the in-house kit (`packages/game-kit`, `packages/shell/src/game-host`) | A turn = "apply the move, then play a short film of what happened" |

Install these only with `npx expo install <pkg>` so they stay on the SDK 57 pins, and re-check with `npx expo install --check`. Skia 2.6.2 has a postinstall that copies the iOS xcframeworks: approve it with `npm approve-scripts @shopify/react-native-skia` (the script disappears in Skia 2.6.5+, that is, with SDK 58).

## Layers and data flow

```
 JS thread (pure, testable)                                  UI thread (worklets, 60/120 Hz)
 ─────────────────────────────────────────────────────       ─────────────────────────────────────
 gesture ──InputIntent──► intentToMove(state, intent) ─► Move
                                    │
               GameSession store: applyMove(state, move) → { state, events }; save write
                                    │  MoveResult { seq, state, events }
                     presentMove(): toView(state) + buildTimeline(events, motion)
                                    │  clock.push(scene)  ─────────────────►  scene (ONE shared value)
                                    │  cues.schedule(tracks) → AudioPort / HapticsPort
                                                                              │ frame callback: runBoardFrame
                                                                              │   stamps startAt, sets now
                                                                              ▼
                                            recordBoard(): sampleTimeline(tracks, now − startAt)
                                                           → draw(canvas, { view, fx, highlight, colors, layout, kit })
                                                                              │
                                                                     <Canvas><Picture/></Canvas>
```

- **The view is always the final state.** Tracks describe how the board gets there. A piece that disappears must be drawable from its tracks alone.
- **One scene per committed move.** `{ seq, view, tracks, endMs, startAt: NOT_STARTED }` travels as one shared value, so the UI thread can never pair a new view with old tracks.
- **Save before animating.** The session store applies and saves the move, then the board presents it. Killing the app mid-animation loses nothing.
- **Idle boards cost nothing.** The frame callback runs only while a timeline plays; a Picture that reads the clock would otherwise re-record every frame.

## Where the code lives (and which skill owns it)

```
packages/game-kit/src/                      pure TS, no React/RN/Expo/Skia
  timeline/  track.ts  sample.ts  particles.ts                  'worklet'   (this skill)
  geom/      board-layout.ts                                    'worklet'   (this skill; hitTest used by input)
  geom/      classify-swipe.ts  stick-command.ts                'worklet'   (board-gestures-and-input)
  contract/  input-intent.ts            (shared contract file: game-rules-engine owns it; board-gestures-and-input ships the same bytes)
  timeline/  fixed-step.ts; geom/ vec2.ts sweep.ts spatial-hash.ts          (realtime-game-loop)
packages/shell/src/game-host/               React Native + Skia + Reanimated
  board-types.ts  board-kit.ts  board-scene.ts  describe-error.ts  run-board-frame.ts
  use-board-clock.ts  record-board.ts  draw-centered-text.ts  board-canvas.tsx
  present-move.ts  cue-scheduler.ts  game-board-host.tsx  paint-board-png.ts
  use-game-lifecycle.ts                                                     (this skill)
  pan-intent.ts  use-board-gestures.ts                                      (board-gestures-and-input)
  run-loop-frame.ts  use-fixed-step-loop.ts  record-sim.ts  realtime-board-host.tsx
  paint-sim-png.ts                                                          (realtime-game-loop)
packages/shell/src/app/use-is-app-active.ts (+ test)                       (shared: this skill and game-audio-and-haptics ship the same bytes)
packages/tooling/src/quality/  check-worklet-boundary.ts (+ test)  worklet-transform.test.ts   (this skill)
apps/<game-id>/src/board/
  board-palettes.json/.ts  board-contrast.json  to-view.ts  build-timeline.ts  board-ids.ts
  layout-board.ts  draw-board.ts  <game-id>-board.ts  + tests               (this skill)
  hit-targets.test.ts (+ drag-lift.test.ts for a board with a lift)         (board-gestures-and-input)
test/goldens/boards/  skia-golden.ts  <game-id>-board.golden.test.ts  __image_snapshots__/  (this skill)
```

Import style: `@e07/<package>/<path-under-src>.ts` with the extension, never `../`. Game code may use only the Shell's game-facing folders (`game-host`, `art`, `theme/theme-types.ts`, the audio port types).

## The GameBoard contract

Game-kit may not import Skia, so the rendering members of a game module are typed in the Shell (`packages/shell/src/game-host/board-types.ts`) and bound as `presentation.board` of the game's `ShellGameModule`:

```ts
export type GameBoard<TState, TView, TToken extends string, TMove = unknown> = {
  readonly isMirroredInRtl: boolean;                               // default false
  readonly toView: (state: TState, format: ViewFormat) => TView;   // JS, pure; digits localised here
  readonly layout: (input: LayoutInput<TView>) => BoardLayout;     // worklet; used by draw AND hit-test
  readonly draw: (canvas: SkCanvas, frame: DrawFrame<TView, TToken>) => void; // worklet, pure
  readonly buildPaths: (skia: SkiaApi) => Readonly<Partial<Record<string, SkPath>>>; // JS, once per kit
  readonly describe: (view: TView) => A11yMessage;                 // VoiceOver summary (catalog key)
  readonly dragLiftPt?: number;                                    // drag pointer lift, applied by the gesture layer (default 0)
  targetsOfMove?(state: TState, move: TMove): readonly BoardTarget[]; // the host outlines the hinted move
};

/** UI state held by the board host (never game state, never a move). */
export type BoardHighlight = {
  readonly selected: BoardTarget | null;           // a tap in one of GameEngine.selectRegions (Line Siege: a tray slot)
  readonly hinted: readonly BoardTarget[];         // targetsOfMove(state, controller.hintedMove())
};
export const EMPTY_HIGHLIGHT: BoardHighlight = { selected: null, hinted: [] };

export type DrawFrame<TView, TToken extends string> = {
  readonly view: TView;            // final state of the move
  readonly fx: BoardFx;            // timeline sample + pointer (finger) sample
  readonly highlight: BoardHighlight; // the host's selection and hint (EMPTY_HIGHLIGHT when none)
  readonly colors: BoardColors<TToken>;
  readonly layout: BoardLayout;
  readonly kit: RenderKit;         // fill/stroke paints, number font, unit paths, paragraph labels
};
```

`GameBoardHost` takes the `highlight` prop and passes it through `BoardCanvas` to `draw` (the host factory of `game-host-integration` builds it from its selection state and the hinted move). The spelling of `BoardHighlight`, `EMPTY_HIGHLIGHT` and the `highlight` prop is part of the contract: the host factory codes against it.

The engine side (`create`, `listMoves`, `applyMove`, `outcome`, `intentToMove`, `buildTimeline`) is pure and lives in game-kit's contract; `buildTimeline(events, motion)` is the one engine member this skill writes.

## Three kinds of boards

| Kind | Games | What moves on screen |
|---|---|---|
| Turn-based (about 24 games) | Line Siege, Flock Tilt, Dig Site … | `applyMove` returns events; `buildTimeline` turns them into tracks; the board clock plays them |
| Simulate-then-replay | Bank Shot, Toggle Drop, Poker Drop cascades | the continuous phase runs inside `applyMove` with a fixed step and returns timed events; tracks replay them (`realtime-game-loop`) |
| Real-time | Halo Drift | a fixed-step loop on the UI thread; the picture reads the sim directly; its draw-call test and goldens (moments of a scripted run) come with `realtime-game-loop` |

## Drawing needs across the catalogue

| Game | Drawing notes |
|---|---|
| Line Siege (pilot) | lanes band above the board, the wall with hearts, three monster kinds with shape cues, beams, shockwave band, bursts, breaches; health digits fitted into half-cell monsters (`drawFittedText`); a 3-slot tray region; the drag ghost at the lifted pointer's cell (`dragLiftPt`); the selected slot ring and the hinted move |
| Flock Tilt, Dock Slide, Merge Siege | one `pos` track per sliding piece; merge pops |
| Scrap Shove, Fuseban | shake and particles (dropped under reduced motion) |
| Jump Chain | several sequential `pos` tracks on one entity (the sampler follows the latest started) |
| Dig Site, Floodline, Deep Sweep | numbers in local digits; flood or collapse as timed per-cell tracks |
| Poker Drop, Rank Ladder, Exact Zero | card faces drawn in code (unit paths plus digits/letters) |
| Grove Shift | wrap-around tween: draw the wrapped copy at both ends |
| Letter Bugs | `isMirroredInRtl: true`; letters as Paragraph labels cached per letter; the formed word is one RTL Paragraph |
| Dice Foundry | pip faces as unit paths |
| Bank Shot, Halo Drift | free-form world scaled to the canvas; many identical sprites via Atlas |

## Prerequisites in the app repo

The host files come in two stages. The **pure/golden stage** compiles with game-kit, the audio and haptics ports and the gesture kit alone, so a game-first repo (`shell-slice.json` with `"screens": []`) builds, unit-tests and golden-tests its board before the Shell exists. The **Shell stage (S5, the Game screen)** needs the Shell's UI and test wrapper; `check-board-files.mjs` prints `SKIP` for these files while `shell-slice.json` lacks `S5`, and checks every import of every present host file (`host-import-unresolved` names the owning skill of anything missing).

| Prerequisite | Path in the app repo | Owner skill | Needed by |
|---|---|---|---|
| Engine contract, `PanMode`, `selectRegions` | `packages/game-kit/src/contract/game-engine.ts` | `game-rules-engine` | both stages |
| RNG (`hashU32` for particles) | `packages/game-kit/src/rng/sfc32.ts` | `game-rules-engine` | both stages |
| `InputIntent` (with `tap.selected`) | `packages/game-kit/src/contract/input-intent.ts` | `game-rules-engine` (shared; `board-gestures-and-input` ships the same file) | both stages |
| Gesture kit | `packages/game-kit/src/geom/classify-swipe.ts`, `packages/shell/src/game-host/pan-intent.ts`, `use-board-gestures.ts` | `board-gestures-and-input` | Shell stage (`board-canvas.tsx` composes the gestures) |
| Audio and haptics ports and their fakes | `packages/shell/src/services/audio/audio-port.ts`, `fake-audio.ts`, `haptics/haptics-port.ts`, `fake-haptics.ts` | `game-audio-and-haptics` | both stages (the cue scheduler and its test) |
| `AppText` (theme, type styles, localised text style) | `packages/shell/src/ui/app-text.tsx` | `toybox-design-system` | Shell stage (the layout probe) |
| `renderWithShell` and its providers | `packages/shell/src/testing/render-with-shell.tsx` | `unit-and-component-tests` | Shell stage (the host, canvas and probe tests) |
| React Native Testing Library 14.0.1 with `test-renderer` 1.2.0 (exact pins, installed together) | root `package.json` devDependencies | `dependency-management` (`plan-dependency`) | both stages (`use-game-lifecycle.test.ts`, the host tests) |
| Skia, Reanimated, Worklets (Expo SDK 57 pins) | each app's `package.json` | `dependency-management` | both stages |
| The game's rules types | `apps/<game-id>/src/rules/<game-id>-types.ts` | `game-rules-engine` | the board templates: state and past-tense events carrying every id and from/to value the animation needs |

| Host file | Stage | Proof |
|---|---|---|
| `board-types.ts`, `board-kit.ts`, `board-scene.ts`, `describe-error.ts`, `present-move.ts`, `cue-scheduler.ts`, `use-game-lifecycle.ts`, `draw-centered-text.ts`, `record-board.ts`, `run-board-frame.ts` | pure/golden | each has a unit test (`*.test.ts`) |
| `paint-board-png.ts` | pure/golden | `device-only` marker: covered by the pixel goldens |
| `use-board-clock.ts` | pure/golden | `device-only` marker: covered by the simulator kill test and the e2e level flow |
| `game-board-host.tsx`, `board-canvas.tsx`, `board-layout-probe.tsx` | Shell (S5) | each has a render test through `renderWithShell` |
| `packages/shell/src/app/use-is-app-active.ts` | pure/golden | its unit test |

A `device-only` marker is the line `// device-only: covered by <e2e flow or simulator check>` in the first 6 lines; the repo's coverage config and test checkers honour it, so native, Skia and frame-callback modules do not sink coverage.
