# Timeline, frame clock, presenter and lifecycle

How a committed move becomes a short animation, and how the clock that plays it starts, stops and survives restarts. Read this before writing `buildTimeline` or touching `board-scene.ts`, `run-board-frame.ts`, `use-board-clock.ts`, `present-move.ts`, `cue-scheduler.ts` or `use-game-lifecycle.ts`.

## Contents

- Tracks and easing
- Sampling rules
- Writing buildTimeline
- The frame clock and the startAt fix
- Presenting a move: save first, fast-forward or queue
- Cues: sound and haptics on the timeline
- Stopping: idle, background, ads, focus
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
- `onDone(seq)` stops the callback only if `seq` is still the current scene's: a "done" for scene 7 can arrive after JS pushed scene 8.
- `useBoardClock` keeps the `FrameCallback` in a ref assigned in an effect: `onDone` needs `frame.setActive(false)`, but `frame` is created from a callback that references `onDone` (a direct reference is a temporal-dead-zone error the React hooks lint reports).
- The frame callback body is one call to `runBoardFrame(wiring, info.timestamp)`, which wraps its work in `try/catch` and reports errors with `scheduleOnRN(onError, describeError(error))`. React Compiler bails out of memoising a hook whose inline callback has `?.` or ternaries inside `try/catch`, and an uncaught UI-thread exception kills the app.

Verified on the iOS 26.5 simulator (Release): 8 consecutive scenes, each stopped and restarted, all started at elapsed 0; a 720 ms timeline ran 45 frames at the 60 fps simulator cap, one frame past its end, then the clock stopped itself.

The clock test (template `board-scene.test.ts`) replays fake `FrameInfo` sequences in which `timeSinceFirstFrame` restarts at 0 after every activation, and proves each new scene starts at 0.

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
| Back to runnable | `audio.resume()`, `clock.resume()`: an interrupted timeline sees `elapsed ≥ endMs` on its first frame and finishes | stays paused until the player resumes (S6) |

`audio.suspend()` / `resume()` return promises: handle them with `.catch(reportError)`, never an async handler.

## 120 Hz

`withShell` (the Expo config composer) sets `ios.infoPlist.CADisableMinimumFrameDurationOnPhone = true`. Without it iOS caps third-party apps at 60 fps on ProMotion phones. Reanimated 4.5.1 and Worklets 0.10.1 already request 120 fps from `CADisplayLink`; the plist key is the only switch. The simulator caps at 60 fps, so the owner confirms 120 Hz on a ProMotion phone with the debug frame-time recorder. Animation time always comes from timestamps, so 60 and 120 Hz play the same timeline.

## Frame-time recording hook

The debug frame-time recorder never owns a frame callback (an extra one would keep idle screens rendering). In test builds, `sampleFrame(histogram, isRecording, info.timeSincePreviousFrame)` is the first statement inside the `try` of `runBoardFrame`, with the two shared values passed through the wiring object. The recorder itself (histogram, report, budgets: hitch rate ≤ 10 ms/s, p95 ≤ 17 ms) belongs to the performance skill.
