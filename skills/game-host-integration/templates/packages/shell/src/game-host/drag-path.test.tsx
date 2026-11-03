// packages/shell/src/game-host/drag-path.test.tsx
// no-shell-context: the tracer is plain data; the gesture case renders only the gesture probe.
import { act, render } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { BoardGestureProbe } from './board-gesture-probe.tsx';
import { createDragPathTracer, traceTarget } from './drag-path.ts';

import type { InputIntent } from '@e07/game-kit/contract/input-intent.ts';
import type { BoardLayout, BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

const LAYOUT: BoardLayout = {
  width: 400,
  height: 400,
  isMirrored: false,
  regions: [{ id: 'board', x: 0, y: 0, cell: 50, cols: 8, rows: 8 }],
};

function cell(col: number, row: number): BoardTarget {
  return { regionId: 'board', col, row };
}

/** The centre of a board cell, as a finger position. */
function at(col: number, row: number, start: BoardTarget) {
  const x = col * 50 + 25;
  const y = row * 50 + 25;
  return { x, y, translationX: x - (start.col * 50 + 25), translationY: y - (start.row * 50 + 25) };
}

describe('createDragPathTracer', () => {
  it('gives a drag-end the path the drag aimed along, each target once per change', () => {
    const tracer = createDragPathTracer();
    tracer.start();
    for (const target of [cell(1, 1), null, cell(1, 1), cell(2, 2), cell(2, 2), cell(3, 1)]) {
      tracer.hover(target);
    }
    const intent: InputIntent = { kind: 'drag-end', from: cell(0, 0), to: cell(3, 1) };
    expect(tracer.finish(intent)).toStrictEqual({
      ...intent,
      path: [cell(0, 0), cell(1, 1), cell(2, 2), cell(3, 1)],
    });
  });

  it('starts every drag with an empty trace', () => {
    const tracer = createDragPathTracer();
    tracer.start();
    tracer.hover(cell(5, 5));
    // That drag never ended in an intent (the system cancelled it); the next one starts afresh.
    tracer.start();
    tracer.hover(cell(1, 0));
    const intent: InputIntent = { kind: 'drag-end', from: cell(0, 0), to: null };
    expect(tracer.finish(intent)).toStrictEqual({ ...intent, path: [cell(0, 0), cell(1, 0)] });
  });

  it('keeps a finished path when the next drag traces', () => {
    const tracer = createDragPathTracer();
    tracer.start();
    tracer.hover(cell(1, 0));
    const intent: InputIntent = { kind: 'drag-end', from: cell(0, 0), to: null };
    const ended = tracer.finish(intent);
    tracer.start();
    tracer.hover(cell(5, 5));
    tracer.hover(cell(6, 6));
    expect(ended).toStrictEqual({ ...intent, path: [cell(0, 0), cell(1, 0)] });
  });

  it('passes every other intent through unchanged', () => {
    const tracer = createDragPathTracer();
    tracer.start();
    tracer.hover(cell(1, 1));
    const tap: InputIntent = { kind: 'tap', target: cell(1, 1), selected: null };
    expect(tracer.finish(tap)).toBe(tap);
  });

  it('traces a drag that loops back to its start cell through the gesture layer', async () => {
    const tracer = createDragPathTracer();
    const sent: InputIntent[] = [];
    await render(
      <BoardGestureProbe
        layout={LAYOUT}
        panMode="drag"
        onIntent={(intent) => sent.push(tracer.finish(intent))}
        onHover={tracer.hover}
        onDragStart={tracer.start}
      />,
    );
    const start = cell(2, 4);
    const loop = [cell(4, 2), cell(2, 0), cell(0, 2), cell(2, 4)].map((target) => ({
      state: State.ACTIVE,
      ...at(target.col, target.row, start),
    }));
    const back = at(2, 4, start);
    await act(() => {
      fireGestureHandler(getByGestureTestId('board.pan'), [
        { state: State.BEGAN, ...back },
        // The pan starts past its 10 pt minimum, the finger still on the start cell.
        { state: State.ACTIVE, ...back, x: back.x + 12, translationX: 12 },
        ...loop,
        { state: State.END, ...back, velocityX: 0, velocityY: 0 },
      ]);
    });
    expect(sent).toStrictEqual([
      {
        kind: 'drag-end',
        from: start,
        to: start,
        path: [start, cell(4, 2), cell(2, 0), cell(0, 2), start],
      },
    ]);
  });
});

describe('traceTarget', () => {
  // A hover runs on every change of the finger's target: the trace grows in place, never copied.
  it('appends a new target to the same array', () => {
    const trace = [cell(0, 0)];
    expect(traceTarget(trace, cell(1, 0))).toBe(trace);
    expect(trace).toStrictEqual([cell(0, 0), cell(1, 0)]);
  });

  it('returns the same array unchanged for its last target or for no target', () => {
    const trace = [cell(0, 0), cell(1, 0)];
    expect(traceTarget(trace, cell(1, 0))).toBe(trace);
    expect(traceTarget(trace, null)).toBe(trace);
    expect(trace).toStrictEqual([cell(0, 0), cell(1, 0)]);
  });
});
