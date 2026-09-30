// packages/shell/src/game-host/run-board-frame.test.ts
import { makeScene, NOT_STARTED } from './board-scene.ts';
import { runBoardFrame } from './run-board-frame.ts';

import type { BoardScene } from './board-scene.ts';
import type { BoardFrameWiring } from './run-board-frame.ts';
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

function wiring(scene: BoardScene<string>): BoardFrameWiring<string> & {
  readonly done: number[];
  readonly errors: string[];
} {
  const done: number[] = [];
  const errors: string[] = [];
  return {
    scene: box(scene),
    now: box(0),
    onDone: (seq) => done.push(seq),
    onError: (message) => errors.push(message),
    done,
    errors,
  };
}

describe('runBoardFrame', () => {
  it('stamps the first frame as the start, then reports done once the timeline ends', async () => {
    const clock = wiring(makeScene(7, 'view', [POP]));
    runBoardFrame(clock, 5000);
    await flushScheduled();
    expect(clock.scene.get().startAt).toBe(5000);
    expect(clock.now.get()).toBe(5000);
    expect(clock.done).toStrictEqual([]);
    runBoardFrame(clock, 5100);
    await flushScheduled();
    expect(clock.scene.get().startAt).toBe(5000);
    expect(clock.done).toStrictEqual([7]);
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
