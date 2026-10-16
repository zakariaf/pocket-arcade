# The board input pipeline

How a finger on a Skia board becomes at most one `InputIntent`, and how that intent becomes a legal move. Read this before touching `use-board-gestures.ts`, `pan-intent.ts`, `classify-swipe.ts` or a game's `intent-to-move.ts`, and before choosing a game's pan mode.

## Contents

- The pipeline
- The InputIntent contract
- Hit-testing with the board's layout
- Gesture composition and thresholds
- Pan modes: none, swipe, drag, aim
- Choosing a pan mode per game
- Pointer, hover and drag previews
- Coordinates, RTL and touch targets
- Android: the system back and edge swipes
- Accessibility and end-to-end taps
- Files and prerequisites

## The pipeline

```
Gesture.Tap / LongPress / Pan (UI thread, worklets)
  → hitTest(layout, point, HIT_SLOP)           the SAME BoardLayout the renderer draws with
  → classifySwipe(...) | drag from→to | aim     panIntent(): at most ONE intent per gesture
  → scheduleOnRN(onIntent, intent)              JS thread
  → board host: a tap in one of engine.selectRegions toggles its UI-only selection and stops here;
                any other tap gets `selected` filled in; a drag-end clears the selection
  → game.intentToMove(state, intent) → Move | null     pure, in apps/<game-id>/src/rules
  → session.dispatch({ type: 'apply-move', move })      applied, saved, then animated
```

- `useBoardGestures(layout, handlers)` in `packages/shell/src/game-host/use-board-gestures.ts` is the **only** file that imports gesture builders. Moving to Gesture Handler v3 then rewrites one file, and a board can never double-move.
- Gestures never decide legality. They report what the finger did in board terms; the game's pure `intentToMove(state, intent)` returns a move or `null`.
- The Game screen's board host wires it (`create-game-board-host`, owned by `game-host-integration`): a tap inside `engine.selectRegions` toggles the selection; otherwise `const move = game.intentToMove(state, { ...intent, selected })` and, when not `null`, `session.dispatch({ type: 'apply-move', move })`, which also clears the selection. Games without select regions (`selectRegions: []`) never see a selection.

## The InputIntent contract

```ts
// packages/game-kit/src/contract/input-intent.ts
export type InputIntent =
  | { readonly kind: 'tap'; readonly target: BoardTarget; readonly selected: BoardTarget | null }
  | { readonly kind: 'long-press'; readonly target: BoardTarget }
  | { readonly kind: 'swipe'; readonly direction: SwipeDirection; readonly from: BoardTarget | null }
  | { readonly kind: 'drag-end'; readonly from: BoardTarget; readonly to: BoardTarget | null }
  /** Release vector of an aim drag, in canvas points (Bank Shot). */
  | { readonly kind: 'aim'; readonly dx: number; readonly dy: number };

type BoardTarget = { readonly regionId: string; readonly col: number; readonly row: number };
type SwipeDirection = 'up' | 'down' | 'left' | 'right';
```

It lives in game-kit (pure) because the engine's `intentToMove` receives it. Kinds are kebab-case string literals. It is one shared contract file (owned by `game-rules-engine`, synced into this skill's `templates/game-kit/contract/`).

`selected` is the board's tap-then-tap selection: the target of an earlier tap inside one of `GameEngine.selectRegions` (Line Siege: a tray slot), or `null`. It is UI state the board host keeps, never game state and never a move, so bots, sims, the witness solver, par, undo and the move counters never see it. The gesture layer always sends `selected: null`; the host fills it in. See `intent-to-move.md`, "Pattern: tap-then-tap".

## Hit-testing with the board's layout

`packages/game-kit/src/geom/board-layout.ts` (a `'worklet'` module the rendering skill provides) holds the layout both sides share:

```ts
/**
 * Canvas point → cell. `slop` (px) extends every region so edge taps still land. A region the
 * point is truly inside always wins; otherwise the nearest region whose slop reaches the point.
 */
export function hitTest(layout: BoardLayout, point: Point, slop = 0): BoardTarget | null {
  const exact = firstHit(layout, point, 0);         // inside a region → clamped { regionId, col, row }
  if (exact !== null || slop <= 0) return exact;
  return nearestSlopHit(layout, point, slop);       // inside region ± slop, nearest drawn region first
}
export function isSameTarget(a: BoardTarget | null, b: BoardTarget | null): boolean { /* structural */ }
```

`regionHit` tests each region where it is drawn: a mirrored region is mirrored as a rectangle (`width - x - regionWidth`), exactly as `cellRect` draws it, so a cell's left edge belongs to that cell in both directions. Never mirror the touch point instead (`width - point.x`): that flips the half-open cell intervals and puts every drawn left edge on the neighbouring column.

- The gesture hook reads the layout from a shared value (`layout.get()`), the same value the picture uses, so what you see is what you touch at any canvas size.
- Regions exist only for tappable areas (board, tray, button strip); a point outside every region (± slop) gives `null`: no intent is sent, and a tap there calls the optional `onMiss` handler (the host drops its tap-then-tap selection).
- `HIT_SLOP = 8` pt extends every region so taps on the outer edge still land. A region the point is truly inside always wins over a neighbour reached only through the slop, and a point inside no region goes to the nearest region whose slop reaches it (the board and the tray may sit closer than 8 pt).
- Mirroring is applied inside `hitTest` from `layout.isMirrored`; gesture code never branches on direction.

## Gesture composition and thresholds

`Gesture.Exclusive(pan, longPress, tap)`: pan beats long-press beats tap. A tap waits only until the finger lifts, so taps feel instant.

| Constant | Value | Where |
|---|---|---|
| `TAP_MAX_MS` | 250 ms | tap `maxDuration` |
| `LONG_PRESS_MS` | 450 ms | long-press `minDuration` |
| `PAN_MIN_DISTANCE` | 10 pt | pan activation |
| `HIT_SLOP` | 8 pt | every `hitTest` |
| `DEFAULT_SWIPE` | 24 pt or 600 pt/s on the dominant axis, dominance 1.2 | `classifySwipe` |

These are starting values: tune per game after play-testing and pass game thresholds to `classifySwipe(input, thresholds)`. Every builder carries `.withTestId('board.<kind>')` (`board.tap`, `board.long-press`, `board.pan`, `board.stick`) so tests can drive it.

Callbacks on the UI thread:

- Tap: `onEnd((event, isSuccess) => …)`: only a successful tap on a region emits `{ kind: 'tap', target, selected: null }` (the host fills in `selected`).
- Long press: `onStart` emits `{ kind: 'long-press', target }` once the hold is recognised.
- Pan: `onStart` records `dragFrom` (hit-test of the start point: `event.x - event.translationX`, never lifted), `onUpdate` moves the lifted pointer and reports hover changes, `onEnd` turns the lifted release into one intent with `panIntent`, `onFinalize` resets the pointer to idle (it runs on success, failure and cancel).

## Pan modes: none, swipe, drag, aim

`panIntent({ mode, pointer, release, layout })` turns a finished pan into at most one intent:

| Mode | Intent | Notes |
|---|---|---|
| `none` | nothing (pan disabled) | taps and long presses only |
| `swipe` | `{ kind: 'swipe', direction, from }` | `classifySwipe({ dx, dy, vx, vy })`: `null` when too short and too slow, or when no axis dominates by 1.2 |
| `drag` | `{ kind: 'drag-end', from, to }` | only when the drag started on a region; `to` is the hit-test of the lifted release point (`dragLiftPt` above the finger), `null` when it is off every region |
| `aim` | `{ kind: 'aim', dx, dy }` | the release vector in canvas points; the game normalises and quantises it |

Continuous input for real-time games is not a pan mode: see [stick-input.md](stick-input.md).

## Choosing a pan mode per game

| Game | Input | `panMode` |
|---|---|---|
| Line Siege | tap a tray block, then a cell (`selectRegions: ['tray']`); drag tray → board with `dragLiftPt` | `drag` |
| Flock Tilt, Snare Snake, Merge Siege, Dock Slide | 4-way swipe | `swipe` |
| Scrap Shove, Stepstone, Swap Guard, Toggle Drop, Poker Drop, Rank Ladder, Exact Zero | tap | `none` |
| Dig Site, Floodline, Deep Sweep | tap; long-press to flag | `none` (long-press is always on) |
| Jump Chain, Trail Clear, Sonar Hand, Letter Bugs, Dice Foundry, Ripple Ten, Last Stop | drag (plus taps) | `drag` |
| Grove Shift | drag along a row or column | `drag` or `swipe` |
| Fuseban | tap or swipe | `swipe` |
| Bank Shot | aim drag, release | `aim` |
| Halo Drift | one-thumb stick | stick gesture (not a pan mode) |

## Pointer, hover and drag previews

- The finger state is a `PointerSample` (`isDown`, `x`, `y`, `hover`, `dragFrom`) in a shared value that the gesture worklets write and the board picture reads as `frame.fx.pointer`: drag ghosts and hover highlights never go through React.
- Only hover **changes** go to JS (`onHover(target)`, compared with `isSameTarget`), where the pure engine can compute a legality preview for the view (Sonar Hand's shape preview, Line Siege's ghost).
- **The drag lift is applied once, here.** When the thumb would hide the dragged piece, the board declares `GameBoard.dragLiftPt` (Line Siege: `DRAG_LIFT_PT` in its `layout-board.ts`) and `BoardCanvas` passes it to `useBoardGestures(layout, { panMode, dragLiftPt, onIntent, onHover })` (`board.dragLiftPt ?? 0`). The gesture layer shifts the pointer it uses for the hover, the drawn ghost and the drop target by the same `liftedPoint(point, dragLiftPt)` (`pan-intent.ts`); the press that starts the drag is never lifted. `intentToMove` and `draw()` never add a lift of their own, so the ghost cell always equals the placed cell (`pan-intent.test.ts` and `use-board-gestures.test.tsx` prove it for the kit; each game with a lift adds a "ghost cell equals placed cell" test, like Line Siege's `drag-lift.test.ts`).
- **A lift must not strand an edge row.** A board with a lift reserves at least `dragLiftPt` of canvas below its last row (Line Siege: the tray area in portrait; a free strip of `DRAG_LIFT_PT` below the board when the tray stands beside it), and a test per layout proves every edge row is still reachable by a lifted drag.
- **Selection and hint highlights are not pointer state.** The host passes them to the canvas as the `highlight` prop (`BoardHighlight { selected, hinted }`), and `draw()` reads `frame.highlight`; Line Siege rings the selected tray slot and outlines the hinted cells.

## Coordinates, RTL and touch targets

- `event.x/y` are canvas-local and physical: they do not mirror under RTL (verified with `forceRTL(true)`). Swipe directions are physical too. A mirrored board (`isMirroredInRtl`) mirrors positions only inside `BoardLayout`.
- Touch targets on boards are at least 44 × 44 pt. Each game proves it with `hit-targets.test.ts`: the smallest region cell of its largest grid is ≥ 44 pt in the board area of a 402 × 874 pt phone (tested at 374 × 660 pt: the width after the 14 pt side margins, and a height below the Toybox S5 board area of 374 × 708 pt so a taller top bar at large text sizes still passes). Line Siege's test also runs the S5 board canvas of other common phones: the screen minus the status bar (54 pt on 390 × 844, 59 pt on 393 × 852, 62 pt on 402 × 874, 20 pt on 375 × 667), the 60 pt game top bar and the board margins 4 / 14 / 40, which gives 362 × 686, 365 × 689, 374 × 708 and 347 × 543 pt. Width is what limits a phone board: eight 44 pt columns need 352 pt plus the layout's own padding, so a 375 pt wide phone cannot reach 44 pt within the design's margins. An exception needs the owner's sign-off in the game's design pass.
- Wrap the app root in `GestureHandlerRootView` (the Shell providers). Never render a `Pressable` (or a Shell button) inside the board's `GestureDetector`: the canvas is its only child and Shell controls are siblings, so React Native's touch system and Gesture Handler stay apart.

## Android: the system back and edge swipes

On Android with gesture navigation (the default since Android 10), a swipe inward from the left or right screen edge is the system back. It is not a board gesture: Android takes it before the app sees a pan, and React Navigation receives it as the hardware back. On the Game screen navigation-and-routing's back handling (`usePreventRemove`) turns it into Pause, as the Back control does (spec 5). So:

- **No gesture exclusion.** Never call Android's system-gesture exclusion (`setSystemGestureExclusionRects`) for a board, and never add a library or native module that does: back must always work, and Android caps exclusions anyway.
- **Taps near the edge still land.** Only an inward swipe that starts in the system's back strip (its width follows the user's back-sensitivity setting) is back; a tap there reaches the board, and `HIT_SLOP` and the 44 pt targets hold unchanged (Android sizes are dp, the same numbers as pt).
- **Swipes and drags start inside the board.** A board's swipe or drag that starts on its outer column can begin in that strip and open Pause instead. The S5 side margins (14 pt) keep most of the board out of it; if a game's main gesture is a horizontal swipe from the edge, start its pan area inside the board frame, never by exclusion.
- **Coordinates are the same.** `event.x/y` stay canvas-local and physical on Android, and an LTR board stays LTR under RTL, as on iOS.

Not yet seen on a device: the emulator check at Android step 6 (an edge swipe on S5 opens Pause and moves no piece; taps on the outer column land; drags, swipes and tap-then-tap behave as on iOS in en and fa). Record what it shows here.

## Accessibility and end-to-end taps

- The board canvas is one accessible image with a spoken summary; VoiceOver users cannot aim at cells. Any action that needs a hold (long-press to flag) also needs another way: a mode toggle in the Game screen or an accessibility action.
- End-to-end tests cannot find cells by testID (a Skia canvas has no accessibility children). In test builds the Game screen publishes the canvas origin and the current `BoardLayout` in a `game.board-layout` text, and Maestro taps `canvas origin + region origin + (col + 0.5) × cell` (mirrored boards: from the right). The e2e skill owns that flow.

## Files and prerequisites

This skill owns `packages/game-kit/src/geom/classify-swipe.ts`, `packages/game-kit/src/geom/stick-command.ts`, `packages/shell/src/game-host/pan-intent.ts`, `use-board-gestures.ts`, the two test probes, and each game's `rules/intent-to-move.ts` and `board/hit-targets.test.ts`. It ships `packages/game-kit/src/contract/input-intent.ts` as a synced copy of the shared contract file that `game-rules-engine` owns (the same bytes in both skills).

`classify-swipe.ts`, `stick-command.ts` and `pan-intent.ts` run inside gesture callbacks on the UI thread, so each starts with `'worklet';` (after the `// path` comment) and imports values only from other `'worklet'` modules; a plain function called there throws on device although every Jest test passes (`check-board-input.mjs` rule `input-worklet`).

It uses, from the board rendering side: `packages/game-kit/src/geom/board-layout.ts` (`BoardLayout`, `BoardTarget`, `hitTest`, `isSameTarget`) and `packages/shell/src/game-host/board-types.ts` (`PointerSample`, `IDLE_POINTER`). When they do not exist yet, build them with `board-rendering-skia` first; a playable board needs both skills.
