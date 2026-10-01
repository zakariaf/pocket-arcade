# Game engine, Skia, Reanimated and gestures

Failures in boards, animation clocks, worklets, determinism, gestures and state updates. Match the text you see in the Symptom column. Status: **verified** = seen and fixed in a real run; **documented** = read in the tool's own source or docs; **open** = not settled, the fix is the current fallback or decision. **owner** = stop and ask the owner, never work around it. Skill = where the full procedure lives.

<!-- Generated from assets/known-failures.json by scripts/check-catalogue.mjs --write. Edit the JSON, not this file. -->

## Contents

- Animation clock
- Determinism
- Worklets
- Board text
- Skia
- Reanimated
- Gestures
- React Compiler
- Frame rate
- State
- Icons
- Motion
- Battery
- Physics

## Animation clock

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `engine-frame-clock-freeze` | The first move animates; every later move freezes, then jumps to the end | Reanimated resets timeSinceFirstFrame to 0 whenever a frame callback is re-activated | On a move JS writes startAt = -1; the frame callback sets startAt = f.timestamp on its first frame and uses f.timestamp - startAt; push view, tracks and startAt as one scene value | verified | `board-rendering-skia` |
| `engine-board-freeze-rewarded-continue` | After a rewarded continue (an ADS_MODE=test build: lose, tap "Watch an ad to continue", close the test video) the run resumes but the board stays on the continue's first frame: the tray is empty, the hearts are outlines, and a screenshot 5 s later is byte-identical; the next move redraws it. The Premium continue on the same seed animates | Cause class A, traced on the simulator 2026-10-01: runFullscreenAd's finally resumes the board, the continue scene is pushed ~20 ms later, the UI's frame for the old scene then reports done, and the round-4 use-board-clock compared that seq with a JS read of scene.get(), which still returned the old seq, so it stopped the continue scene before its first frame. A race: whether the UI runs a frame between the resume and the push decides it. Round 4 recorded the defect in admob-ads' smoke test and game-host-integration's session flow as "reported to the board-rendering owner"; this entry replaces those notes. Both device traces (perf-log entries of kind board-clock: the rewarded continue and the Premium continue on the same seed) are in board-rendering-skia's references/timeline-and-clock.md | board-rendering-skia's board-clock-state.ts (done messages carry their run; finishRun ignores a stale one; pushes while not runnable are held; every resume records a frame); check-board-code rule clock-runnable; admob-ads' ads-smoke/04-rewarded-continue.yaml asserts game.board-frame settled. Run the ads-smoke flows by hand on an ADS_MODE=test build after a fresh install started with xcrun simctl launch, never by e2e:ios. The integrator's final ADS_MODE=test build passed flows 1 to 5 on one fresh install (flow 4: game.board-frame settled for the continue's seq) and flow 6 on its own (2026-10-01) | verified | `board-rendering-skia` |

## Determinism

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `engine-cross-engine-determinism` | A replay or bot run recorded in Jest diverges on the device (or iOS vs Android) | Hermes computes Math.sin, cos, exp, atan2 and pow with the platform C library; V8 uses its own | Rules, sims, geom and daily generation use only + - * /, Math.sqrt, imul, floor, round, abs, min, max; integer PRNG (sfc32); lint bans the rest there | verified | `game-rules-engine` |
| `engine-create-finished` | A level starts already won or lost | The game's create() returned a finished state | Fix create(); engineContractProblems and check-rules-engine now require every level to start in play | verified | `game-rules-engine` |

## Worklets

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `engine-missing-worklet` | A crash on the UI thread when a gesture or frame callback calls a helper | A function without the 'worklet' directive cannot run on the UI thread (runtime, not build-time error) | Use the file-level 'worklet'; directive for sim, geom, layout and render modules; test that UI-thread modules import only worklet modules | verified | `realtime-game-loop` |
| `engine-runonjs-deprecated` | runOnJS logs a deprecation warning, or code from memory uses runOnJS and .value | Worklets 0.10 deprecates runOnJS; the React Compiler needs shared-value accessors | Use scheduleOnRN(fn, ...args) from react-native-worklets and .get()/.set() | verified | `realtime-game-loop` |
| `engine-worklet-closure-copy` | A worklet keeps using an old value after JS changed it | Values captured by a worklet are copied when it is first scheduled | Pass anything that changes through a shared value; no promises, await, setTimeout or third-party code in worklets | documented | `realtime-game-loop` |
| `engine-frame-callback-throw` | The board freezes after an exception inside a frame callback | An uncaught error on the UI thread stops the callback silently | Every frame body is one call into runBoardFrame/runLoopFrame, which wraps it in try/catch, stops the callback and reports through scheduleOnRN so the game pauses and records the error | verified | `board-rendering-skia` |

## Board text

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `engine-drawtext-arabic` | Persian or Sorani words on a board render as broken, unjoined letters | canvas.drawText does no shaping | Use Skia Paragraph (ParagraphBuilder with TextDirection.RTL) for Arabic-script words; drawText only for digits and Latin | verified | `board-rendering-skia` |
| `engine-paragraph-per-frame` | Frame drops when a board shows text | Building a Paragraph every frame is costly | Build on text or locale change and cache; use a retained <Paragraph> node (capture inside a Picture worklet is unverified) | documented | `board-rendering-skia` |

## Skia

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `engine-canvas-onlayout` | Canvas onLayout does not fire on the New Architecture | Canvas onLayout is deprecated on Fabric | Use onSize or useCanvasSize() | verified | `board-rendering-skia` |
| `engine-headless-fonts` | Text is missing in Jest golden images or headless renders | Skia's jestSetup mocks useFonts and matchFont to null | Load the TTF with Skia.Typeface.MakeFreeTypeFaceFromData in text golden tests | verified | `golden-tests` |
| `engine-skia-mutable-path` | Skia logs a deprecation warning for moveTo, addCircle or transform | Skia 2.6 moved to immutable paths; the old SkPath mutators still work but will be removed | Build paths once with Skia.PathBuilder.Make()...build() at unit size and place them with canvas.save/translate/scale/restore | verified | `board-rendering-skia` |

## Reanimated

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `engine-reduced-motion-constant` | Changing Reduce Motion while the app runs has no effect | Reanimated's useReducedMotion is a constant captured at module load | Read reduce motion through the Shell setting and ReducedMotionConfig; restart needed for the system value | verified | `accessibility` |
| `engine-shared-value-access` | Shared value updates misbehave under the React Compiler | .value access is not compiler-safe | Use .get() and .set() | verified | `react-components-and-hooks` |

## Gestures

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `engine-rngh-v3-migration` | Gesture callbacks never fire after the SDK 58 upgrade, or gestures cannot be composed | RNGH 3 renames onStart->onActivate, onEnd->onDeactivate, merges onChange into onUpdate, and hook-based gestures cannot relate to builder gestures | Keep gestures behind useBoardGestures and move all of a board's gestures to hooks in one commit | verified | `board-gestures-and-input` |
| `engine-swipe-thresholds` | Swipes feel wrong or taps wait | Thresholds (24 pt, 600 pt/s, 1.2 ratio, 450 ms long press) are unvalidated; composition order matters | Tune per game on a device; Exclusive(pan, longPress, tap) must be tested so taps do not wait | open | `board-gestures-and-input` |
| `engine-slider-blocks-scroll` | The Settings list does not scroll when a drag starts on a volume slider, and the volume jumps | The slider's pan gesture had minDistance(0) | Race pan and tap: the pan starts after 8 pt sideways and fails after 8 pt vertically (current toybox-components Slider); check on a device | documented | `toybox-components` |

## React Compiler

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `engine-compiler-try-catch` | React Compiler skips a hook: "value blocks within a try/catch" | The compiler bails out on some try/catch shapes | Move frame bodies into runner functions | verified | `react-components-and-hooks` |

## Frame rate

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `engine-sim-60fps` | The simulator never exceeds 60 fps; a 120 Hz loop measured 115.9 ticks/s | The simulator is capped at 60 fps; CADisplayLink timing differs | Count ticks, never wall time; the owner checks 120 Hz and real-time speed on a ProMotion iPhone with the frame recorder | open | `performance-budgets` |
| `engine-sim-kit-alloc` | A real-time sim drops frames or triggers garbage collection with vec2 or sweep in its tick | vec2 and sweep return new objects on every call; a UI-thread tick must allocate nothing | Write the maths with plain numbers inside step functions (geom-kit, "Inside a UI-thread sim"); check-realtime-loop reports it | documented | `realtime-game-loop` |

## State

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `engine-zustand-new-object` | Maximum update depth exceeded after reading a store | A Zustand v5 selector returned a new object or array on every call | Return primitives or stable references, or wrap the selector in useShallow from zustand/shallow | verified | `state-stores` |

## Icons

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `engine-icon-even-odd` | Icons such as mail, globe, theme and eye render filled solid | The path union comes back even-odd | Apply AsWinding after the union (build-icon-paths.ts does) | verified | `code-drawn-art-and-icons` |

## Motion

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `engine-spring-mass` | withSpring feels heavy and slow | Reanimated 4.5.1's withSpring default mass is 4 | Pass mass: 1 (Toybox motion tokens) | verified | `toybox-design-system` |

## Battery

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `engine-frame-callback-idle` | The phone stays warm while nothing moves | A Picture that reads the clock re-records every frame | Stop the frame callback when no track is active; pause on background, ads and focus loss | documented | `board-rendering-skia` |

## Physics

| ID | Symptom | Cause | Fix | Status | Skill |
|---|---|---|---|---|---|
| `engine-tunnelling` | A fast ball passes through a wall or a corner hit bounces wrong | Discrete steps skip thin obstacles at high speed | Swept collision tests, a small fixed step and properties such as "never leaves the arena" and "energy never increases" | documented | `realtime-game-loop` |
| `engine-spatial-hash-stride` | Collisions are missed or land in the wrong cell, with no error | rebuildSpatialHash expects two numbers per entity, but a sim body array holds four (x, y, vx, vy) | Pass positions with stride 2, never the raw body array (geom-kit reference) | documented | `realtime-game-loop` |
