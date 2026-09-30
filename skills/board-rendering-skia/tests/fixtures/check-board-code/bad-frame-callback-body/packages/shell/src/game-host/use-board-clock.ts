// packages/shell/src/game-host/use-board-clock.ts
import { useEffect, useRef } from 'react';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';

import { runBoardFrame } from './run-board-frame.ts';

import type { BoardScene } from './board-scene.ts';
import type { FrameCallback, SharedValue } from 'react-native-reanimated';

export type BoardClock<TView> = {
  readonly scene: SharedValue<BoardScene<TView>>;
  /** Latest FrameInfo.timestamp seen by the clock; the picture reads it to re-record. */
  readonly now: SharedValue<number>;
  /** JS: show a new scene and run the clock until its timeline ends. */
  readonly push: (next: BoardScene<TView>) => void;
  /** JS: stop the clock (pause, background, ad, blur). */
  readonly stop: () => void;
  /** JS: restart after stop(); an interrupted timeline jumps to its end state. */
  readonly resume: () => void;
};

export function useBoardClock<TView>(
  initial: BoardScene<TView>,
  onError: (message: string) => void,
): BoardClock<TView> {
  const scene = useSharedValue(initial);
  const now = useSharedValue(0);
  // Breaks the cycle "frame callback → JS handler → frame.setActive" without TDZ access.
  const frameRef = useRef<FrameCallback | null>(null);
  const onDone = (seq: number): void => {
    // A newer scene may have been pushed while this message was in flight: keep running.
    if (seq === scene.get().seq) frameRef.current?.setActive(false);
  };
  const handleError = (message: string): void => {
    frameRef.current?.setActive(false);
    onError(message);
  };
  const wiring = { scene, now, onDone, onError: handleError };
  const frame = useFrameCallback((info) => {
    const current = scene.get();
    if (current.startAt === -1) scene.set({ ...current, startAt: info.timestamp });
    now.set(info.timestamp);
  }, false);
  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);
  return {
    scene,
    now,
    push: (next) => {
      scene.set(next);
      frame.setActive(true);
    },
    stop: () => {
      frame.setActive(false);
    },
    resume: () => {
      frame.setActive(true);
    },
  };
}
