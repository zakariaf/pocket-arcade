// packages/shell/src/game-host/run-board-frame.ts
'worklet';

import { scheduleOnRN } from 'react-native-worklets';

import { NOT_STARTED, tickClock } from './board-scene.ts';
import { describeError } from './describe-error.ts';

import type { BoardScene } from './board-scene.ts';
import type { SharedValue } from 'react-native-reanimated';

/**
 * The whole body of the turn-based board clock's frame callback. Kept out of the hook:
 * one worklet call per frame, try/catch in one place, and React Compiler still memoises
 * the hook (it bails out on value blocks such as ?. or ternaries inside try/catch).
 */
export type BoardFrameWiring<TView> = {
  readonly scene: SharedValue<BoardScene<TView>>;
  readonly now: SharedValue<number>;
  readonly onDone: (seq: number) => void;
  readonly onError: (message: string) => void;
};

export function runBoardFrame<TView>(wiring: BoardFrameWiring<TView>, timestamp: number): void {
  try {
    const current = wiring.scene.get();
    const tick = tickClock(current, timestamp);
    const age = frameInfo.timeSinceFirstFrame;
    if (current.startAt === NOT_STARTED) wiring.scene.set({ ...current, startAt: tick.startAt });
    wiring.now.set(timestamp);
    if (tick.isDone) scheduleOnRN(wiring.onDone, current.seq);
  } catch (error) {
    scheduleOnRN(wiring.onError, describeError(error));
  }
}
