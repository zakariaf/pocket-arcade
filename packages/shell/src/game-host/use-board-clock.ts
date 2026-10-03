// packages/shell/src/game-host/use-board-clock.ts
// device-only: covered by the simulator kill test, the e2e level flow and admob-ads' rewarded-continue smoke flow (useFrameCallback needs the UI thread).
import { useEffect, useState } from 'react';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';

import {
  finishRun,
  haltClock,
  initialClockControl,
  NO_TRACE_WINDOW,
  pushScene,
  resumeClock,
  stopClock,
} from './board-clock-state.ts';
import { runBoardFrame } from './run-board-frame.ts';

import type { BoardClockLabel, ClockStep, SceneHead } from './board-clock-state.ts';
import type { BoardScene } from './board-scene.ts';
import type { ClockSample } from './run-board-frame.ts';
import type { FrameCallback, SharedValue } from 'react-native-reanimated';

export type BoardClock<TView> = {
  readonly scene: SharedValue<BoardScene<TView>>;
  /** Latest FrameInfo.timestamp seen by the clock; the picture reads it to re-record. */
  readonly now: SharedValue<number>;
  /** JS: show a new scene; it plays now while the board is runnable, else once it is again. */
  readonly push: (next: BoardScene<TView>) => void;
  /** JS: the board may not run (pause, background, ad, blur): stop the clock. */
  readonly stop: () => void;
  /** JS: the board may run again: at least one frame, an interrupted timeline jumps to its end. */
  readonly resume: () => void;
  /** JS, test builds: one trace entry with the clock's last seq and run (no-op without a trace). */
  readonly trace: (label: BoardClockLabel) => void;
};

/** A JS-side trace entry: the UI's numbers for frames, the last pushed scene's for the rest. */
export type ClockTraceSample = Omit<ClockSample, 'startAt' | 'elapsedMs'> & {
  readonly startAt: number | null;
  readonly elapsedMs: number | null;
  /** 'done' only: the message named an older run, so it changed nothing. */
  readonly isStale?: boolean;
};
export type ClockTraceSink = (label: BoardClockLabel, sample: ClockTraceSample) => void;

export type BoardClockOptions = {
  /** Test builds with boardLayout=1: the board-clock trace; null otherwise. */
  readonly trace: ClockTraceSink | null;
  /** Test builds: S15's frame recorder (a worklet); null otherwise. */
  readonly onFrameTime: ((dtMs: number | null) => void) | null;
};

const NO_OPTIONS: BoardClockOptions = { trace: null, onFrameTime: null };

type Push = (next: SceneHead & Pick<BoardScene<unknown>, 'startAt'>) => void;

/** What the driver reaches once the board has rendered (useBoardClock's effect). */
type DriverParts = {
  readonly frame: Pick<FrameCallback, 'setActive'>;
  readonly sink: ClockTraceSink | null;
  readonly onError: (message: string) => void;
};

/** The clock's JS half, one per board: every switch is a board-clock-state step. */
type ClockDriver = Pick<BoardClock<unknown>, 'stop' | 'resume' | 'trace'> & {
  readonly connect: (parts: DriverParts) => void;
  readonly push: Push;
  /** The frame runner's done message: stops the clock only for the run that is still current. */
  readonly onDone: (doneRun: number, seq: number) => void;
  /** A draw or frame error: halt, then the host pauses the run. */
  readonly onError: (message: string) => void;
};

/**
 * JS keeps its own record of the clock and never reads the scene shared value back. Created once
 * per board (useState), so onDone and onError keep their identity inside the frame callback.
 */
function createClockDriver(initial: SceneHead, run: Pick<SharedValue<number>, 'set'>): ClockDriver {
  let control = initialClockControl(initial);
  let parts: DriverParts | null = null;
  const trace = (label: BoardClockLabel, sample: Partial<ClockTraceSample> = {}): void => {
    const base = { seq: control.seq, endMs: control.endMs, run: control.run };
    parts?.sink?.(label, { ...base, startAt: null, elapsedMs: null, ...sample });
  };
  // The one place the frame callback is switched: the run reaches the UI before the frame does.
  const apply = (step: ClockStep, label: BoardClockLabel | null): void => {
    control = step.control;
    if (step.setActive === true) run.set(step.control.run);
    if (step.setActive !== null) parts?.frame.setActive(step.setActive);
    if (label !== null) trace(label);
  };
  return {
    connect: (next) => {
      parts = next;
    },
    push: (next) => {
      apply(pushScene(control, next), null);
      trace('push', { startAt: next.startAt, elapsedMs: 0 });
    },
    stop: () => {
      apply(stopClock(control), 'stop');
    },
    resume: () => {
      apply(resumeClock(control), 'resume');
    },
    trace,
    onDone: (doneRun, seq) => {
      const isStale = doneRun !== control.run;
      const step = finishRun(control, doneRun);
      apply(step, null);
      if (step.isApplied || isStale) trace('done', { seq, run: doneRun, isStale });
    },
    onError: (message) => {
      apply(haltClock(control), null);
      parts?.onError(message);
    },
  };
}

/**
 * The frame clock. Every decision goes through board-clock-state: JS keeps its own record of the
 * last push and the current run, and never reads the scene shared value (a JS read can return the
 * scene from before the last push until the UI thread has applied it). A done message names the
 * run it ended, so a stale one never stops a newer scene or a resume.
 */
export function useBoardClock<TView>(
  initial: BoardScene<TView>,
  onError: (message: string) => void,
  options: BoardClockOptions = NO_OPTIONS,
): BoardClock<TView> {
  const scene = useSharedValue(initial);
  const now = useSharedValue(0);
  const run = useSharedValue(0);
  const window = useSharedValue(NO_TRACE_WINDOW);
  const [driver] = useState(() => createClockDriver(initial, run));
  const { trace: sink, onFrameTime } = options;
  const onFrame = (sample: ClockSample): void => {
    sink?.('frame', sample);
  };
  const trace = sink === null ? null : { window, onFrame };
  const { onDone } = driver;
  const wiring = { scene, now, run, onDone, onError: driver.onError, trace, onFrameTime };
  const frame = useFrameCallback((info) => {
    runBoardFrame(wiring, info.timestamp, info.timeSincePreviousFrame);
  }, false);
  useEffect(() => {
    driver.connect({ frame, sink, onError });
  }, [driver, frame, sink, onError]);
  return {
    scene,
    now,
    push: (next) => {
      scene.set(next);
      driver.push(next);
    },
    stop: driver.stop,
    resume: driver.resume,
    trace: driver.trace,
  };
}
