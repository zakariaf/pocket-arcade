// packages/shell/src/game-host/run-board-frame.test.ts
import { NO_TRACE_WINDOW, TRACE_SAMPLE_MS } from './board-clock-state.ts';
import { makeScene, NOT_STARTED } from './board-scene.ts';
import { runBoardFrame } from './run-board-frame.ts';

import type { TraceWindow } from './board-clock-state.ts';
import type { BoardScene } from './board-scene.ts';
import type { BoardFrameWiring, ClockSample } from './run-board-frame.ts';
import type { Track } from '@e07/game-kit/timeline/track.ts';
import type { SharedValue } from 'react-native-reanimated';

/** The Worklets Jest mock delivers scheduleOnRN as a microtask (on device: the next JS turn). */
async function flushScheduled(): Promise<void> {
  await new Promise<void>((resolve) => {
    setImmediate(() => {
      resolve();
    });
  });
}

const POP: Track = {
  channel: 'pop',
  entityId: 1,
  startMs: 0,
  durationMs: 100,
  easing: 'linear',
  from: [0],
  to: [1],
};

/** Stands in for a shared value: plain get/set on a box. */
function box<T>(initial: T): SharedValue<T> {
  let value = initial;
  return {
    get: () => value,
    set: (next: T) => {
      value = next;
    },
  } as unknown as SharedValue<T>;
}

type Recorded = {
  readonly done: (readonly [number, number])[];
  readonly errors: string[];
  readonly frames: ClockSample[];
  readonly dts: (number | null)[];
};

function wiring(
  scene: BoardScene<string>,
  run = 3,
  isTraced = false,
): BoardFrameWiring<string> & Recorded {
  const recorded: Recorded = { done: [], errors: [], frames: [], dts: [] };
  return {
    ...recorded,
    scene: box(scene),
    now: box(0),
    run: box(run),
    onDone: (doneRun, seq) => recorded.done.push([doneRun, seq]),
    onError: (message) => recorded.errors.push(message),
    trace: isTraced
      ? {
          window: box<TraceWindow>(NO_TRACE_WINDOW),
          onFrame: (sample) => recorded.frames.push(sample),
        }
      : null,
    onFrameTime: (dtMs) => {
      recorded.dts.push(dtMs);
    },
  };
}

describe('runBoardFrame', () => {
  it('stamps the first frame as the start, then reports done with its run and seq', async () => {
    const clock = wiring(makeScene(7, 'view', [POP]));
    runBoardFrame(clock, 5000);
    await flushScheduled();
    expect(clock.scene.get().startAt).toBe(5000);
    expect(clock.now.get()).toBe(5000);
    expect(clock.done).toStrictEqual([]);
    runBoardFrame(clock, 5100, 100);
    await flushScheduled();
    expect(clock.scene.get().startAt).toBe(5000);
    expect(clock.done).toStrictEqual([[3, 7]]);
    expect(clock.dts).toStrictEqual([null, 100]);
  });

  it('traces the first frame, one per sample interval and the last, when the trace is on', async () => {
    const clock = wiring(makeScene(7, 'view', [POP]), 3, true);
    for (const timestamp of [5000, 5016, 5000 + TRACE_SAMPLE_MS]) runBoardFrame(clock, timestamp);
    await flushScheduled();
    expect(clock.frames).toStrictEqual([
      { run: 3, seq: 7, startAt: 5000, elapsedMs: 0, endMs: 100 },
      { run: 3, seq: 7, startAt: 5000, elapsedMs: 100, endMs: 100 },
    ]);
  });

  it('reports an error instead of throwing on the UI thread', async () => {
    const clock = wiring(makeScene(1, 'view', []));
    const broken = {
      ...clock,
      scene: {
        get: () => {
          throw new Error('scene gone');
        },
      } as unknown as SharedValue<BoardScene<string>>,
    };
    expect(() => {
      runBoardFrame(broken, 10);
    }).not.toThrow();
    await flushScheduled();
    expect(clock.errors).toStrictEqual(['Error: scene gone']);
    expect(clock.scene.get().startAt).toBe(NOT_STARTED);
  });
});
