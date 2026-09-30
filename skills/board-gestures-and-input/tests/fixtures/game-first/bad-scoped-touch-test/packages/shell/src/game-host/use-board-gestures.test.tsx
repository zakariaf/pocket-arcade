// packages/shell/src/game-host/use-board-gestures.test.tsx
// no-shell-context: the gesture hook takes its layout and callbacks as arguments and reads no store, catalog or port.
// Gesture tests need act(): the Worklets Jest mock delivers scheduleOnRN as a microtask.
import { act, render } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { BoardGestureProbe } from './board-gesture-probe.tsx';
import { StickGestureProbe } from './stick-gesture-probe.tsx';

import type { BoardLayout } from '@e07/game-kit/geom/board-layout.ts';
import type { SharedValue } from 'react-native-reanimated';

const LAYOUT: BoardLayout = {
  width: 400,
  height: 400,
  isMirrored: false,
  regions: [{ id: 'board', x: 0, y: 0, cell: 50, cols: 8, rows: 8 }],
};

/** A pan from (25, 25) that moves by (dx, dy) and is released there. */
function pan(dx: number, dy: number): Parameters<typeof fireGestureHandler>[1] {
  const end = { x: 25 + dx, y: 25 + dy, translationX: dx, translationY: dy };
  return [
    { state: State.BEGAN, x: 25, y: 25, translationX: 0, translationY: 0 },
    { state: State.ACTIVE, x: 40, y: 25, translationX: 15, translationY: 0 },
    { state: State.ACTIVE, ...end },
    { state: State.END, ...end, velocityX: 0, velocityY: 0 },
  ];
}

describe('useBoardGestures', () => {
  it('turns a tap into a tap intent on the hit cell', async () => {
    const onIntent = jest.fn();
    await render(<BoardGestureProbe layout={LAYOUT} panMode="drag" onIntent={onIntent} />);
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
      selected: null,
    });
  });

  it('reports a tap outside every region as a miss, never as an intent', async () => {
    const onIntent = jest.fn();
    const onMiss = jest.fn();
    const wide = { ...LAYOUT, width: 600 };
    await render(
      <BoardGestureProbe layout={wide} panMode="drag" onIntent={onIntent} onMiss={onMiss} />,
    );
    await act(() => {
      fireGestureHandler(getByGestureTestId('board.tap'), [
        { state: State.BEGAN, x: 560, y: 60 },
        { state: State.ACTIVE, x: 560, y: 60 },
        { state: State.END, x: 560, y: 60 },
      ]);
    });
    expect(onMiss).toHaveBeenCalledTimes(1);
    expect(onIntent).not.toHaveBeenCalled();
  });

  it('turns a drag into ONE drag-end intent from the start cell to the release cell', async () => {
    const onIntent = jest.fn();
    await render(<BoardGestureProbe layout={LAYOUT} panMode="drag" onIntent={onIntent} />);
    await act(() => {
      fireGestureHandler(getByGestureTestId('board.pan'), pan(100, 150));
    });
    expect(onIntent).toHaveBeenCalledTimes(1);
    expect(onIntent).toHaveBeenCalledWith({
      kind: 'drag-end',
      from: { regionId: 'board', col: 0, row: 0 },
      to: { regionId: 'board', col: 2, row: 3 },
    });
  });

  it('turns a swipe into ONE physical direction', async () => {
    const onIntent = jest.fn();
    await render(<BoardGestureProbe layout={LAYOUT} panMode="swipe" onIntent={onIntent} />);
    await act(() => {
      fireGestureHandler(getByGestureTestId('board.pan'), pan(0, 120));
    });
    expect(onIntent).toHaveBeenCalledTimes(1);
    expect(onIntent).toHaveBeenCalledWith({
      kind: 'swipe',
      direction: 'down',
      from: { regionId: 'board', col: 0, row: 0 },
    });
  });

  it('reports hover changes, not every finger move', async () => {
    const onHover = jest.fn();
    await render(
      <BoardGestureProbe layout={LAYOUT} panMode="drag" onIntent={jest.fn()} onHover={onHover} />,
    );
    await act(() => {
      fireGestureHandler(getByGestureTestId('board.pan'), pan(100, 150));
    });
    expect(onHover.mock.calls).toStrictEqual([[{ regionId: 'board', col: 2, row: 3 }]]);
  });

  it('lifts the hover and the drop target alike, so the ghost cell is the placed cell', async () => {
    const onIntent = jest.fn();
    const onHover = jest.fn();
    await render(
      <BoardGestureProbe
        layout={LAYOUT}
        panMode="drag"
        dragLiftPt={50}
        onIntent={onIntent}
        onHover={onHover}
      />,
    );
    await act(() => {
      fireGestureHandler(getByGestureTestId('board.pan'), pan(100, 150));
    });
    // The finger ends in row 3 (y 175); the lifted pointer, its ghost and the drop are in row 2.
    const lastHover: unknown = onHover.mock.calls.at(-1)?.[0];
    expect(lastHover).toStrictEqual({ regionId: 'board', col: 2, row: 2 });
    expect(onIntent).toHaveBeenCalledWith({
      kind: 'drag-end',
      from: { regionId: 'board', col: 0, row: 0 },
      to: lastHover,
    });
  });

  it('turns a long press into a long-press intent on the held cell', async () => {
    const onIntent = jest.fn();
    await render(<BoardGestureProbe layout={LAYOUT} panMode="none" onIntent={onIntent} />);
    await act(() => {
      fireGestureHandler(getByGestureTestId('board.long-press'), [
        { state: State.BEGAN, x: 60, y: 110 },
        { state: State.ACTIVE, x: 60, y: 110 },
        { state: State.END, x: 60, y: 110 },
      ]);
    });
    expect(onIntent).toHaveBeenCalledWith({
      kind: 'long-press',
      target: { regionId: 'board', col: 1, row: 2 },
    });
  });
});

describe('makeStickGesture', () => {
  it('writes each new integer stick command once, and 0 when the finger lifts', async () => {
    const writes: number[] = [];
    let current = 0;
    /** Stands in for the loop's command shared value and records every write. */
    const command = {
      get: () => current,
      set: (value: number) => {
        writes.push(value);
        current = value;
      },
    } as unknown as SharedValue<number>;
    await render(<StickGestureProbe command={command} />);
    await act(() => {
      fireGestureHandler(getByGestureTestId('board.stick'), [
        { state: State.BEGAN, translationX: 0, translationY: 0 },
        { state: State.ACTIVE, translationX: 0, translationY: 20 },
        { state: State.ACTIVE, translationX: 0, translationY: 40 },
        { state: State.ACTIVE, translationX: 40, translationY: 0 },
        { state: State.END, translationX: 40, translationY: 0 },
      ]);
    });
    expect(writes).toStrictEqual([5, 1, 0]);
  });
});
