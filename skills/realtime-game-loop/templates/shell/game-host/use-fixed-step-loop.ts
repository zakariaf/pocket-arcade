// packages/shell/src/game-host/use-fixed-step-loop.ts
// device-only: covered by the simulator play-through of a real-time level (useFrameCallback needs the UI thread; run-loop-frame.test.ts proves the frame body).
import { useEffect, useRef } from 'react';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';

import { runLoopFrame } from './run-loop-frame.ts';

import type { FrameCallback, SharedValue } from 'react-native-reanimated';

/** What a real-time game provides. Both functions are worklets that mutate `sim` in place. */
export type FixedStepSim<TSim> = {
  /** Advance exactly one tick with the current input command. */
  readonly step: (sim: TSim, command: number) => void;
  /** Copy out and clear this frame's events (hits, deaths, wave end) as a flat int list. */
  readonly drainEvents: (sim: TSim) => readonly number[];
};

export type FixedStepLoop = { readonly start: () => void; readonly stop: () => void };

type LoopWiring<TSim> = {
  readonly sim: SharedValue<TSim>;
  /** Current input command (quantised integer, written by gesture worklets). */
  readonly command: SharedValue<number>;
  readonly game: FixedStepSim<TSim>;
  /** JS: batched events for sound, HUD, stats and save points; at most once per frame. */
  readonly onEvents: (events: readonly number[]) => void;
  readonly onError: (message: string) => void;
};

export function useFixedStepLoop<TSim>(input: LoopWiring<TSim>): FixedStepLoop {
  const accMs = useSharedValue(0);
  const frameRef = useRef<FrameCallback | null>(null);
  const handleError = (message: string): void => {
    frameRef.current?.setActive(false);
    input.onError(message);
  };
  const { sim, command, game, onEvents } = input;
  const wiring = {
    sim,
    command,
    accMs,
    step: game.step,
    drainEvents: game.drainEvents,
    onEvents,
    onError: handleError,
  };
  const frame = useFrameCallback((info) => {
    runLoopFrame(wiring, info.timeSincePreviousFrame);
  }, false);
  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);
  return {
    start: () => {
      accMs.set(0);
      frame.setActive(true);
    },
    stop: () => {
      frame.setActive(false);
    },
  };
}
