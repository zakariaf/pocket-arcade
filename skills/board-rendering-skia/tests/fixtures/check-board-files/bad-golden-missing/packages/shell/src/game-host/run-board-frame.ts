// packages/shell/src/game-host/run-board-frame.ts
'worklet';

import { scheduleOnRN } from 'react-native-worklets';

import { traceFrameStep } from './board-clock-state.ts';
import { NOT_STARTED, tickClock } from './board-scene.ts';
import { describeError } from './describe-error.ts';

import type { TraceWindow } from './board-clock-state.ts';
import type { BoardScene } from './board-scene.ts';
import type { SharedValue } from 'react-native-reanimated';

/** One traced frame as the UI thread saw it (the JS side adds the lifecycle flags). */
export type ClockSample = {
  readonly run: number;
  readonly seq: number;
  readonly startAt: number;
  readonly elapsedMs: number;
  readonly endMs: number;
};

/** Test builds with the trace on: the UI thread's window and the JS sink of sampled frames. */
export type BoardFrameTrace = {
  readonly window: SharedValue<TraceWindow>;
  readonly onFrame: (sample: ClockSample) => void;
};

/**
 * The whole body of the turn-based board clock's frame callback. Kept out of the hook:
 * one worklet call per frame, try/catch in one place, and React Compiler still memoises
 * the hook (it bails out on value blocks such as ?. or ternaries inside try/catch).
 */
export type BoardFrameWiring<TView> = {
  readonly scene: SharedValue<BoardScene<TView>>;
  readonly now: SharedValue<number>;
  /** The JS side's current run (board-clock-state), written before every setActive(true). */
  readonly run: SharedValue<number>;
  /** The scene has ended: JS stops the clock only if `run` is still its current run. */
  readonly onDone: (run: number, seq: number) => void;
  readonly onError: (message: string) => void;
  /** Test builds with the trace on (boardLayout=1); null otherwise. */
  readonly trace: BoardFrameTrace | null;
  /** Test builds: S15's frame recorder (a worklet that samples dtMs while recording); null otherwise. */
  readonly onFrameTime: ((dtMs: number | null) => void) | null;
};

function traceFrame<TView>(
  wiring: BoardFrameWiring<TView>,
  sample: ClockSample,
  frame: { readonly run: number; readonly timestamp: number; readonly isDone: boolean },
): void {
  const trace = wiring.trace;
  if (trace === null) return;
  const step = traceFrameStep(trace.window.get(), frame);
  trace.window.set(step.window);
  if (step.isSampled) scheduleOnRN(trace.onFrame, sample);
}

export function runBoardFrame<TView>(
  wiring: BoardFrameWiring<TView>,
  timestamp: number,
  dtMs: number | null = null,
): void {
  try {
    const current = wiring.scene.get();
    const run = wiring.run.get();
    const tick = tickClock(current, timestamp);
    if (current.startAt === NOT_STARTED) wiring.scene.set({ ...current, startAt: tick.startAt });
    wiring.now.set(timestamp);
    wiring.onFrameTime?.(dtMs);
    const sample = {
      run,
      seq: current.seq,
      startAt: tick.startAt,
      elapsedMs: tick.elapsedMs,
      endMs: current.endMs,
    };
    traceFrame(wiring, sample, { run, timestamp, isDone: tick.isDone });
    if (tick.isDone) scheduleOnRN(wiring.onDone, run, current.seq);
  } catch (error) {
    scheduleOnRN(wiring.onError, describeError(error));
  }
}
