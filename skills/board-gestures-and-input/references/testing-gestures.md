# Testing board input

How input is proven in Jest without a device, and the traps of the Gesture Handler and Worklets test mocks. Read this before writing or changing a gesture test.

## Contents

- Test set-up
- What each test proves
- Driving a gesture
- Traps in the mocks
- On the simulator

## Test set-up

The `unit` Jest project (preset `jest-expo/ios`) needs these lines in `jest.setup.ts` (Gesture Handler 2.32, Worklets 0.10.1, Reanimated 4.5.1):

```ts
import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
require('react-native-reanimated').setUpTests();
```

Gesture tests render a small test host, not the Skia canvas (Skia's JSI module does not load in the `unit` project): `board-gesture-probe.tsx` wires `useBoardGestures` to a plain `View`, and `stick-gesture-probe.tsx` does the same for `makeStickGesture`.

## What each test proves

| Test | File | Proves |
|---|---|---|
| `classifySwipe` examples | `classify-swipe.test.ts` | dominant axis → physical direction, fast short flick accepted, too short and slow or too diagonal rejected, per-game thresholds |
| `panIntent` examples | `pan-intent.test.ts` | each pan mode yields the right single intent; a drag that did not start on a region yields nothing; a lifted drag drops on the cell above the finger (the ghost's cell), lifting only y by exactly `dragLiftPt` |
| `stickCommand` property | `stick-command.test.ts` | dead zone, the four axes, and every command within 11.25° of the drag |
| Gestures end to end | `use-board-gestures.test.tsx` | tap → cell with `selected: null`; drag → ONE drag-end; a lifted drag's hover and drop land on the same cell; swipe → ONE direction; hover reported on change only; long press → cell; stick writes each new command once and 0 on lift |
| Legality | `apps/<game-id>/src/rules/intent-to-move.test.ts` | the game's intents map to moves `listMoves` lists, or `null` (also on a won and a lost state, and for taps inside `selectRegions`) |
| Touch targets | `apps/<game-id>/src/board/hit-targets.test.ts` | smallest hit region ≥ 44 pt on a 402 × 874 pt phone; with a lift, every edge row reachable in portrait and wide layouts |
| Drag lift | `apps/<game-id>/src/board/drag-lift.test.ts` (boards with `dragLiftPt`) | the board declares the lift, and the ghost is drawn exactly on the cell the block is placed on |
| Layout round trip | `layout-board.test.ts` (rendering skill) | `hitTest(cellRect(c)) = c` at any size, mirrored or not |

## Driving a gesture

```tsx
import { act, render } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

await render(<BoardGestureProbe layout={LAYOUT} panMode="drag" onIntent={onIntent} />);
await act(() => {
  fireGestureHandler(getByGestureTestId('board.pan'), [
    { state: State.BEGAN, x: 25, y: 25, translationX: 0, translationY: 0 },
    { state: State.ACTIVE, x: 40, y: 25, translationX: 15, translationY: 0 },
    { state: State.ACTIVE, x: 125, y: 175, translationX: 100, translationY: 150 },
    { state: State.END, x: 125, y: 175, translationX: 100, translationY: 150, velocityX: 0, velocityY: 0 },
  ]);
});
expect(onIntent).toHaveBeenCalledTimes(1);
```

- `getByGestureTestId` finds a gesture by its `.withTestId(...)`; give every builder one.
- Wrap `fireGestureHandler` in `await act(...)`: the Worklets Jest mock delivers `scheduleOnRN` as a microtask, and `act` flushes it.
- Assert `toHaveBeenCalledTimes(1)` for pans: the rule is at most one intent per gesture.
- RNTL 14's `render` and `renderHook` are async: `await` them.

## Traps in the mocks

- **Sequences are completed for you.** `fireGestureHandler` fills in missing states, so a list that stops at `ACTIVE` still ends the gesture (and runs `onFinalize`). To observe intermediate values, record every write instead of reading the final value.
- **Shared values from the mock are frozen objects.** `jest.spyOn(sharedValue, 'set')` throws "Cannot assign to read only property 'set'". Pass a stand-in object with `get`/`set` that records writes (see the stick test).
- **The first `ACTIVE` event runs `onStart` only; `onUpdate` runs from the second `ACTIVE` event on** (verified with the 2.32 Jest mock: `BEGAN, ACTIVE(10), ACTIVE(20), END` gives `onStart(10)` then `onUpdate(20)`). A test that needs an update (hover, stick command) must send at least two `ACTIVE` events. Put what must happen once per gesture in `onStart`/`onEnd`, never in `onUpdate`.
- **Hover calls go to JS on change only**: a drag across three cells calls `onHover` once per new cell, not once per event.

## On the simulator

Jest proves the logic of the pipeline; a Release simulator build proves that real touches reach the Skia canvas (verified for a point tap from Maestro). After the tests pass, play a level on the simulator: tap, drag and swipe on the board, including cells on the outer edge, and check the ghost and hover preview follow the finger.
