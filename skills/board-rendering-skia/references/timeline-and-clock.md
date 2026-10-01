# Timeline, frame clock, presenter and lifecycle

How a committed move becomes a short animation, and how the clock that plays it starts, stops and survives restarts. Read this before writing `buildTimeline` or touching `board-scene.ts`, `board-clock-state.ts`, `run-board-frame.ts`, `use-board-clock.ts`, `present-move.ts`, `cue-scheduler.ts` or `use-game-lifecycle.ts`.

## Contents

- Tracks and easing
- Sampling rules
- Writing buildTimeline
- The frame clock and the startAt fix
- The clock's decisions: board-clock-state
- The frozen board after a rewarded continue (2026-10-01)
- Presenting a move: save first, fast-forward or queue
- Cues: sound and haptics on the timeline
- Stopping: idle, background, ads, focus
- The board-clock trace and the game.board-frame probe (test builds)
- 120 Hz
- Frame-time recording hook

## Tracks and easing

A `Track` is pure data: "entity 3's `row` channel goes from 1 to 2 between 420 ms and 640 ms, easing in-out, and when it starts play `hit` with a medium haptic".

```ts
export type Track = {
  readonly channel: string;          // 'pos', 'pop', 'beam', 'burst', 'gone' …
  readonly entityId: number;         // piece id, or a cell id from board-ids.ts
  readonly startMs: number;
  readonly durationMs: number;
  readonly easing: EasingId;         // 'linear' | 'in-quad' | 'out-quad' | 'in-out-quad' | 'out-cubic' | 'out-back'
  readonly from: readonly number[];  // equal-length number vectors, interpolated per component
  readonly to: readonly number[];
  readonly cue?: TrackCue;           // { sound?: string; haptic?: HapticCue } fired when the track starts
};
export type Motion = 'full' | 'reduced';
```

- Easings are polynomials only (`+ - *`), so they stay inside the determinism policy and replay identically in Jest and on device.
- `timelineEndMs(tracks)` is the latest `startMs + durationMs`: the scene is done at that elapsed time.
- Channel names are per game; keep them short and documented at the top of `build-timeline.ts`.

## Sampling rules

`sampleTimeline(tracks, elapsedMs)` samples every `(channel, entity)` key once:

- **Before a key's first track starts**, the key holds that track's `from` (a monster waits in its old cell until its move begins).
- **Several tracks on one key**: the latest started wins; if none started, the earliest unstarted one. So a multi-jump chain is several sequential `pos` tracks on one entity.
- **After the end**, the key holds `to` exactly, with `progress` 1 and `ageMs` = duration.
- `fxEntry(fx, channel, id)` returns `undefined` when there is no track: draw the view's final state.
- Each entry has `values`, eased `progress` (0…1) and `ageMs` (clamped to 0…duration) for particles.
- **So an entry exists before its track has started.** A tween of something already visible may use the held `from` (a monster waiting in its old row). An effect layer that only exists while it plays (flash, wave, glow, burst, shake) must draw only when `ageMs > 0` and `progress < 1` (the `isPlaying` helper of the templates and the Line Siege example), or it shows at full strength at moment 0.

## Writing buildTimeline

`buildTimeline(events, motion)` is pure: the same events always give the same tracks. Pattern (the template does exactly this):

1. One small function per event kind, returning `Track[]`, dispatched by an exhaustive `switch (event.kind)`.
2. Beat start times as named constants (the template's `NEIGHBOUR_DELAY_MS`, `CLEAR_AT_MS`; Line Siege's `AT.clear`, `AT.beam`, `AT.hit`, `AT.defeat`, `AT.march`) so a turn reads as a score.
3. `const timing = { scale: motion === 'full' ? 1 : 0.5, isFull: motion === 'full' }`; under `'reduced'`: halve durations, drop particle (`burst`) and shake tracks, use `'linear'` instead of `'out-back'` (no overshoot). The Shell passes `'reduced'` when the Reduce motion setting is on (it defaults to the OS setting); never read `useReducedMotion()` for this, it is evaluated once at module load.
4. Things that vanish get a track that carries their position (Line Siege's `vanish` channel holds `[lane, row, kind, alpha]` for a defeated or breaching monster; its `clear` channel fades each cleared cell once).
5. Put the sound and haptic on the track that starts the beat (the template's first `flip` track carries `cue: { sound: 'flip', haptic: 'light' }`; Line Siege's six cues are `place`, `beam`, `shock`, `hit`, `pop`, `breach`).

Tests (template `build-timeline.test.ts`): the busiest turn stays within `TURN_BUDGET_MS` (1200 ms default), reduced motion has no `burst` and no `out-back` and is shorter, the first cue is right, and the output is deterministic.

## The frame clock and the startAt fix

The bug in the first design: the clock wrote `now = frameInfo.timeSinceFirstFrame`, JS stored `t0 = now`, and the callback was stopped when idle. Reanimated 4.5.1 sets `startTime = null` whenever a frame callback is deactivated, so after a restart `timeSinceFirstFrame` begins at 0 again while `t0` held the old value: every animation after the first started at a negative elapsed time and froze. Using `timestamp` alone is also wrong (a stopped clock leaves `now` stale).

The fix is a sentinel:

- JS pushes `makeScene(seq, view, tracks)`, whose `startAt` is `NOT_STARTED` (-1).
- `runBoardFrame` (the whole frame-callback body) calls `tickClock(scene, info.timestamp)`: on the first frame it stamps `startAt = timestamp`, and `elapsed = timestamp − startAt` from then on. It writes `now`, and when `elapsed ≥ endMs` it sends `onDone(seq)` to JS with `scheduleOnRN`.
- The picture draws `sceneElapsedMs(scene, now)`: 0 while `startAt` is still the sentinel, so a just-pushed scene shows its first frame.
- `onDone(run, seq)` stops the callback only if `run` is still the clock's current run (`finishRun` in `board-clock-state.ts`, next section): a "done" for an older scene, or one sent before a stop and a resume, can arrive after JS pushed a newer scene. Never compare it with a JS read of the scene shared value (the freeze below).
- `useBoardClock` creates one clock driver per board (`useState`), which holds the JS side's record (`ClockControl`) and reaches the `FrameCallback` through `connect(...)` in an effect: `onDone` needs `frame.setActive(false)`, but `frame` is created from a callback that references `onDone` (a direct reference is a temporal-dead-zone error the React hooks lint reports).
- The frame callback body is one call to `runBoardFrame(wiring, info.timestamp, info.timeSincePreviousFrame)`, which wraps its work in `try/catch` and reports errors with `scheduleOnRN(onError, describeError(error))`. React Compiler bails out of memoising a hook whose inline callback has `?.` or ternaries inside `try/catch`, and an uncaught UI-thread exception kills the app.

Verified on the iOS 26.5 simulator (Release): 8 consecutive scenes, each stopped and restarted, all started at elapsed 0; a 720 ms timeline ran 45 frames at the 60 fps simulator cap, one frame past its end, then the clock stopped itself.

The clock test (template `board-scene.test.ts`) replays fake `FrameInfo` sequences in which `timeSinceFirstFrame` restarts at 0 after every activation, and proves each new scene starts at 0.

## The clock's decisions: board-clock-state

`board-clock-state.ts` (a `'worklet'` module with no Reanimated import, so Jest replays device traces through it) holds every decision; `useBoardClock`'s driver applies each step and is the one place that calls `setActive`:

| JS call | Step | Effect |
|---|---|---|
| `push(scene)` (a move, a continue, a new run) | `pushScene` | new `run`; the scene (always `startAt` `NOT_STARTED`) plays at once while the board is runnable, and is **held** while it is not (an ad on screen, the screen not focused, the app inactive): it starts on the first frame after the board is runnable again, so the animation plays when the player can see it |
| `stop()` (lifecycle `onPause`) | `stopClock` | new `run`, not runnable, callback off: every `done` already on its way is void |
| `resume()` (lifecycle `onResume`) | `resumeClock` | new `run`, runnable, callback **always** on, even when the scene has ended: at least one frame is recorded after the board is visible again, so the canvas never keeps a picture recorded while it was covered; an interrupted timeline jumps to its end, a held scene starts |
| `onDone(run, seq)` (from the UI) | `finishRun` | stops only when `run` is the current run; anything else is stale and changes nothing |
| `onError(message)` | `haltClock` | callback off until the next push or resume; the host pauses the run |

Before every `setActive(true)` the driver writes the new run into the `run` shared value, so the frame that starts names the run it belongs to. The invariant (D63), proven by `board-clock-state.test.ts` and by `board-clock-traces.test.ts`, which replays the two device traces below: (1) a scene pushed while the board is not runnable is held with `startAt` `NOT_STARTED` and starts on the first frame after the board is runnable; (2) every return to runnable records at least one frame after the board is visible; (3) a stale `onDone` never stops a newer scene. `check-board-code.mjs` rule `clock-runnable` fails a `use-board-clock.ts` that does not route push, stop, resume and done through these functions, switches the callback with a literal `setActive(true|false)`, or reads `scene.get()` on the JS thread (fixture `bad-clock-push-while-paused`: the round-4 hook).

## The frozen board after a rewarded continue (2026-10-01)

Symptom (round 4, and reproduced here): lose a level, tap "Continue - watch an ad", watch Google's test rewarded ad to its reward and close it. The run continues and the save is right, but the board stays on the first frame of the continue animation (Line Siege: the hearts drawn as outlines, the three tray slots empty) until the next move; a screenshot 5 s later is byte-identical, and `game.board-frame` reads `{"seq":2,"settled":false}` for good. The Premium continue on the same seed animates in full.

Recorded on the iOS 26.5 simulator (an `ADS_MODE=test` Release build of the round-4 templates plus the trace below, Line Siege level 1, `seed=42`, `boardLayout=1`), as perf-log `board-clock` entries (ms since the first entry; `run` is the clock's run token, `act`/`foc`/`ad` the lifecycle facts):

| Rewarded continue (round 4) | Premium continue, same seed (round 4) |
|---|---|
| `9153 push seq 1` (action=lose-level), frame, `done seq 1` (clock off) | `9377 push seq 1`, frame, `done seq 1` (clock off) |
| `18460 runnable ad 1`, `18462 stop` (the ad covers the app; the app stays active, S7 is an overlay so the screen stays focused) | (no ad) |
| `84733 runnable ad 0`, `84740 resume` (run 4, scene seq 1, long ended) | |
| `84761 push run 5 seq 2 end 540` (the continue, dispatched after `runFullscreenAd`'s `finally` resumed the gate) | `18472 push run 4 seq 2 end 540` (the continue) |
| `84763 frame run 4 seq 1 elapsed 75566`: the UI ran the resume's frame before it applied the push | frames of run 4, seq 2: elapsed 0, 100 ... 517, 550 |
| `84764 done seq 1`: the hook compared 1 with a JS read of `scene.get().seq`, which still returned **1**, and stopped the clock | `done seq 2` at elapsed 550: the clock stops after the end |
| no frame for seq 2 ever: the picture keeps `sceneElapsedMs = 0` of the continue scene | `settled: true` |

**Cause class A: the clock was stopped while the continue scene was unfinished, by a stale `onDone`.** The resume after the ad starts a frame for the old scene; the continue is pushed 21 ms later; the UI's frame for the old scene reports done; and the round-4 `onDone(seq)` guarded itself with `seq === scene.get().seq`, a JS read that returns the JS thread's cached copy until the UI thread has applied the newest write (Reanimated 4.5 mutables), so the stale done matched and stopped the new scene before its first frame. The Premium continue has no resume right before its push, so no stale done is in flight. Not the canvas presentation (class B): frames simply stopped. The order of `runFullscreenAd`'s `finally` and the continue is correct and stays.

The fix (these templates): the run token. `finishRun` compares the done message's run with the JS record's run, never a shared value read back on JS. The same steps on the fixed build (2026-10-01): `107572 resume run 5 seq 1`, `107603 push run 6 seq 2`, `107613 frame run 5 seq 1`, `107614 done run 5 isStale true` (ignored), `107648 frame run 6 seq 2 elapsed 0` ... `108225 frame run 6 elapsed 591`, `done run 6`: `game.board-frame` `{"seq":2,"settled":true}`, the tray shows its three pieces and the hearts are restored, the animation playing once the ad has closed. On the same build the Premium continue, an ordinary move, Next with an interstitial (closed, the next level settled), Pause and Resume, and Home in the middle of the continue animation with the app reopened 7 s later (one frame at resume, `settled: true`) all settle. admob-ads' `ads-smoke/04-rewarded-continue.yaml` asserts it on a device, and fails on the round-4 hook.

## Presenting a move: save first, fast-forward or queue

`GameBoardHost` receives the session's latest `MoveResult { seq, state, events }` (already applied AND saved) and calls `presentMove`:

1. `cues.cancel()`: drop the previous move's unfired sounds and haptics.
2. `tracks = buildTimeline(events, motion)`.
3. `clock.push(makeScene(seq, toView(state), tracks))`: the new scene replaces a running one. Because the view is the final state, that is a clean fast-forward.
4. `cues.schedule(tracks)`.

Input policy per game: `fast-forward` (default: a move arriving mid-animation replaces the scene) or `queue` (when the animation carries information the player needs first, the Game screen waits for `isSceneAnimating(scene, now) === false` before accepting input).

## Cues: sound and haptics on the timeline

`createCueScheduler(audio, haptics)`: sounds go to `audio.play(id, startMs)` (scheduled on the audio clock), haptics fire immediately for `startMs <= 0` and through `setTimeout(…, startMs)` otherwise; `cancel()` clears the timers and calls `audio.cancelPending()`. The ports (`AudioPort`, `HapticsPort`) belong to the audio skill; the template test uses inline fakes.

## Stopping: idle, background, ads, focus

`useGameLifecycle({ isFocused, isFullscreenAdShowing, onPause, onResume })` is the ONE place that decides whether a board may run: app active (`useIsAppActive`, from `AppState`) AND the Game screen focused (`useIsFocused()` from React Navigation) AND no full-screen ad on screen.

| Event | Turn-based board | Real-time board |
|---|---|---|
| Timeline ends | clock stops itself (`onDone`) | n/a |
| Background, ad, blur | `clock.stop()`, `cues.cancel()`, `audio.suspend()` | stop the loop, save point, show Pause |
| A move or a continue pushed while not runnable | held (`pushScene`): its first frame comes after the board is visible again | n/a |
| Back to runnable | `audio.resume()`, `clock.resume()`: always at least one frame; an interrupted timeline sees `elapsed ≥ endMs` on its first frame and finishes, a held scene starts | stays paused until the player resumes (S6) |

`audio.suspend()` / `resume()` return promises: handle them with `.catch(reportError)`, never an async handler.

A full-screen ad does not background the app on iOS and S7 is an overlay inside S5, so `isFocused` stays true: the only fact that changes is `isFullscreenAdShowing` (game-host-integration's `fullscreen-gate.ts`, through `runFullscreenAd`). The rewarded continue is dispatched after `runFullscreenAd`'s `finally` has resumed the gate, so the lifecycle's `resume()` and the continue's `push()` arrive within a few milliseconds, in that order: exactly the window in which a stale done used to stop the new scene (above). `useGameLifecycle` also reports the three facts (`onFlags`) before it decides, which the trace records as `runnable` entries.

## The board-clock trace and the game.board-frame probe (test builds)

While the debug link's `boardLayout=1` is on (test builds only; store builds pass nothing), `GameBoardHost` gets `traceClock` (game-host-integration's `debug-switches.ts`: `traceClock()` appends to the perf log) and writes one perf-log entry per clock event, kind `'board-clock'` (performance-budgets' `perf-log.ts` keeps the newest 400 of them beside its 200 evidence entries): label `push`, `stop`, `resume`, `frame`, `done` or `runnable`, data `{ seq, startAt, elapsedMs, endMs, run, isAppActive, isFocused, isAdShowing }` (`done` adds `isStale`). UI-thread frames are sampled for 2 s after each run's first frame (`traceFrameStep`: the first frame, one every 100 ms and the frame that ends the scene) and reach JS through `scheduleOnRN`. Read them from the app container: `sqlite3 <container>/Documents/SQLite/save.db "select payload from perf_log where id=1"`, then keep the `board-clock` entries.

The same switch makes `BoardLayoutProbe` publish `game.board-frame` = `{"seq":<n>,"settled":<b>}`, computed on the UI thread by `boardFrameOf(scene, now)` from the values the picture is recorded from (`settled`: the picture was recorded at or after the scene's end). It changes only when `seq` or `settled` changes. A flow waits for it after a move, a continue or a full-screen ad (`extendedWaitUntil: visible: { id: 'game.board-frame', text: '.*"settled":true.*' }`).

## 120 Hz

`withShell` (the Expo config composer) sets `ios.infoPlist.CADisableMinimumFrameDurationOnPhone = true`. Without it iOS caps third-party apps at 60 fps on ProMotion phones. Reanimated 4.5.1 and Worklets 0.10.1 already request 120 fps from `CADisplayLink`; the plist key is the only switch. The simulator caps at 60 fps, so the owner confirms 120 Hz on a ProMotion phone with the debug frame-time recorder. Animation time always comes from timestamps, so 60 and 120 Hz play the same timeline.

## Frame-time recording hook

The debug frame-time recorder never owns a frame callback (an extra one would keep idle screens rendering). In test builds the board host gets `onFrameTime` (game-host-integration's `debug-switches.ts`: a worklet over S15's recorder, `sampleFrame(perf.frames.histogram, perf.frames.isRecording, dt)`), and `runBoardFrame` calls `wiring.onFrameTime?.(info.timeSincePreviousFrame)` on every frame; store builds pass `null`. So S15's "Record frame times" measures the board's own frames (round 4 never fed it). The recorder itself (histogram, report, budgets: hitch rate ≤ 10 ms/s, p95 ≤ 17 ms) belongs to the performance skill.
