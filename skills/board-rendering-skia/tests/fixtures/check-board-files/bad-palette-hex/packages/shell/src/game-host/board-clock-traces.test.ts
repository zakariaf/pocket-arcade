// packages/shell/src/game-host/board-clock-traces.test.ts
// Replays the two board-clock traces recorded on the simulator on 2026-10-01 (an ADS_MODE=test
// Release build on iOS 26.5, Line Siege level 1 with seed 42, boardLayout=1, the board-clock
// perf-log entries in the order the JS thread wrote them) through the clock's decisions:
// - the rewarded continue: the ad closes, the lifecycle resumes the clock (run 4) on the lost
//   scene, the continue scene is pushed (run 5, seq 2), then the UI's frame of run 4 (the old
//   scene, long ended) reports done. The round-4 hook compared the done seq with a JS read of the
//   scene shared value, which still returned seq 1 (the UI had not applied the push yet), and
//   stopped the clock: the continue scene never got a frame (the frozen board, cause class A);
// - the Premium continue on the same seed: the continue scene (run 4, seq 2) plays 0..550 ms, done.
// Invariant (D63): when a trace ends with the board runnable, its last pushed scene has either
// been recorded at its end or the clock is still running to get there.
import {
  finishRun,
  initialClockControl,
  pushScene,
  resumeClock,
  stopClock,
} from './board-clock-state.ts';

import type { ClockControl, ClockStep } from './board-clock-state.ts';

type Recorded =
  | { readonly label: 'push'; readonly run: number; readonly seq: number; readonly endMs: number }
  | { readonly label: 'stop' }
  | { readonly label: 'resume'; readonly run: number }
  | {
      readonly label: 'frame';
      readonly run: number;
      readonly seq: number;
      readonly elapsedMs: number;
      readonly endMs: number;
    }
  /** readSeq: what the round-4 hook's JS read of scene.get().seq returned for this message. */
  | {
      readonly label: 'done';
      readonly run: number;
      readonly seq: number;
      readonly readSeq: number;
    };

/** 04:47 local, rewarded continue (perf-log board-clock entries 1-15, runnable entries left out). */
const REWARDED: readonly Recorded[] = [
  { label: 'push', run: 1, seq: 0, endMs: 0 },
  { label: 'resume', run: 2 },
  { label: 'frame', run: 2, seq: 0, elapsedMs: 0, endMs: 0 },
  { label: 'done', run: 2, seq: 0, readSeq: 0 },
  { label: 'push', run: 3, seq: 1, endMs: 0 }, // action=lose-level
  { label: 'frame', run: 3, seq: 1, elapsedMs: 0, endMs: 0 },
  { label: 'done', run: 3, seq: 1, readSeq: 1 },
  { label: 'stop' }, // the rewarded ad covers the app (isAdShowing true)
  { label: 'resume', run: 4 }, // the ad closed, 66 s later
  { label: 'push', run: 5, seq: 2, endMs: 540 }, // the continue, 21 ms after the resume
  { label: 'frame', run: 4, seq: 1, elapsedMs: 75_566, endMs: 0 }, // the UI still had seq 1
  { label: 'done', run: 4, seq: 1, readSeq: 1 }, // round 4: 1 === 1, so it stopped the clock
];

/** 04:51 local, the Premium continue on the same seed (entries 19-32). */
const PREMIUM: readonly Recorded[] = [
  { label: 'push', run: 1, seq: 0, endMs: 0 },
  { label: 'resume', run: 2 },
  { label: 'frame', run: 2, seq: 0, elapsedMs: 0, endMs: 0 },
  { label: 'done', run: 2, seq: 0, readSeq: 0 },
  { label: 'push', run: 3, seq: 1, endMs: 0 },
  { label: 'frame', run: 3, seq: 1, elapsedMs: 0, endMs: 0 },
  { label: 'done', run: 3, seq: 1, readSeq: 1 },
  { label: 'push', run: 4, seq: 2, endMs: 540 }, // the continue
  ...[0, 100, 200, 300, 400, 517, 550].map(
    (elapsedMs) => ({ label: 'frame', run: 4, seq: 2, elapsedMs, endMs: 540 }) as const,
  ),
  { label: 'done', run: 4, seq: 2, readSeq: 2 },
];

/** How a hook answers the trace's messages; isActive: whether its frame callback runs at the end. */
type ClockLogic = {
  readonly apply: (event: Exclude<Recorded, { label: 'frame' }>) => void;
  readonly isActive: () => boolean;
};

/** The round-4 hook, as it was: kept here as the regression's reference. */
function round4Logic(): ClockLogic {
  let isActive = false;
  return {
    apply: (event) => {
      if (event.label === 'push' || event.label === 'resume') isActive = true;
      if (event.label === 'stop') isActive = false;
      if (event.label === 'done' && event.seq === event.readSeq) isActive = false;
    },
    isActive: () => isActive,
  };
}

/** board-clock-state, as use-board-clock applies it; recorded runs map to the replay's runs. */
function currentLogic(): ClockLogic {
  let control: ClockControl = initialClockControl({ seq: 0, endMs: 0 });
  const runs = new Map<number, number>();
  const step = (next: ClockStep, recordedRun: number | null): void => {
    control = next.control;
    if (recordedRun !== null) runs.set(recordedRun, control.run);
  };
  return {
    apply: (event) => {
      if (event.label === 'push') step(pushScene(control, event), event.run);
      if (event.label === 'resume') step(resumeClock(control), event.run);
      if (event.label === 'stop') step(stopClock(control), null);
      if (event.label === 'done') step(finishRun(control, runs.get(event.run) ?? -1), null);
    },
    isActive: () => control.isActive,
  };
}

type Outcome = { readonly lastSeq: number; readonly isEnded: boolean; readonly isRunning: boolean };

function replay(trace: readonly Recorded[], logic: ClockLogic): Outcome {
  let last = { seq: -1, endMs: 0 };
  let isEnded = false;
  for (const event of trace) {
    if (event.label === 'frame') {
      isEnded ||= event.seq === last.seq && event.elapsedMs >= last.endMs;
      continue;
    }
    if (event.label === 'push') {
      last = event;
      isEnded = false;
    }
    logic.apply(event);
  }
  return { lastSeq: last.seq, isEnded, isRunning: logic.isActive() };
}

/** D63: the last pushed scene was recorded at its end, or the clock still runs toward it. */
function isFrozen(outcome: Outcome): boolean {
  return !outcome.isEnded && !outcome.isRunning;
}

describe('the recorded board-clock traces (2026-10-01)', () => {
  it('reproduces the frozen continue with the round-4 hook (the reference)', () => {
    expect(replay(REWARDED, round4Logic())).toStrictEqual({
      lastSeq: 2,
      isEnded: false,
      isRunning: false,
    });
  });

  it('keeps the clock running for the continue scene after a rewarded ad', () => {
    const outcome = replay(REWARDED, currentLogic());
    expect(outcome).toStrictEqual({ lastSeq: 2, isEnded: false, isRunning: true });
    expect(isFrozen(outcome)).toBe(false);
  });

  it.each([
    ['round 4', round4Logic],
    ['board-clock-state', currentLogic],
  ])('plays the Premium continue to its end with %s', (_name, logic) => {
    const outcome = replay(PREMIUM, logic());
    expect(outcome).toStrictEqual({ lastSeq: 2, isEnded: true, isRunning: false });
    expect(isFrozen(outcome)).toBe(false);
  });
});
