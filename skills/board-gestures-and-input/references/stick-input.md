# Stick input for real-time games

How a continuous one-thumb stick (Halo Drift) becomes integer commands a fixed-step simulation can record and replay. Read this before adding continuous input to a board.

## Why integers

A real-time sim must replay bit-exactly from a recorded `(tick, command)` log, on every device and in Jest. Floats from gestures (a drag angle, a velocity) would put device-dependent values into the sim. So the gesture side quantises the drag into one of 17 integer commands and the sim only ever sees that integer.

## The command table

- `0` = idle (no finger, or inside the dead zone of 12 pt).
- `k` = 1…16 = the unit vector `(cos((k-1)·22.5°), sin((k-1)·22.5°))` in canvas coordinates, where y points down: 1 = right, 5 = down, 9 = left, 13 = up.
- The 16 vectors are precomputed once with Node and committed as literals (`STICK_DIRECTIONS` in `packages/game-kit/src/geom/stick-command.ts`); no `Math.cos`/`Math.sin` at runtime (the determinism policy bans them).
- `stickCommand(dx, dy)` picks the direction with the largest dot product with the drag vector: no `atan2`, and every command is within 11.25° of the drag.
- The sim keeps the same table in the same order (its own `STICK` constant); if one side changes, both change in one commit and the replay tests are re-run.

## The gesture

`makeStickGesture(command)` in `use-board-gestures.ts` (still the only gesture file):

```ts
export function makeStickGesture(command: SharedValue<number>): PanGesture {
  return Gesture.Pan()
    .withTestId('board.stick')
    .minDistance(0)
    .onUpdate((event) => {
      const next = stickCommand(event.translationX, event.translationY);
      if (next !== command.get()) command.set(next);   // write only on change
    })
    .onFinalize(() => {
      command.set(STICK_IDLE);                          // finger lifted, failed or cancelled
    });
}
```

- A plain builder (no hooks inside), so a host can call it during render: the real-time host takes it as `makeGesture={makeStickGesture}` and passes the loop's `command` shared value.
- The command lives in a shared value on the UI thread; the loop reads it once per frame and the sim records each change as an input event `(tick, command)`. Nothing goes through React or JS per frame.
- A pan anywhere on the board drives the stick (the drag vector is relative to where the finger went down), so the thumb never has to find a small control.

## Tests

- `stick-command.test.ts`: the dead zone, the four axes (1, 5, 9, 13), and a fast-check property that every command is an integer 1…16 within 11.25° of the drag.
- `use-board-gestures.test.tsx` (`makeStickGesture`): a drag that turns from down to right writes `[5, 1, 0]`: each new command once, then 0 when the finger lifts.
- The sim's replay and frame-grouping tests (the `realtime-game-loop` skill) prove the recorded commands reproduce the run.
