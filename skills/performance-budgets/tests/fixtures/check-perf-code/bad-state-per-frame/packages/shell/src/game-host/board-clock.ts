import { Skia } from '@shopify/react-native-skia';
import { useFrameCallback } from 'react-native-reanimated';

import type { SharedValue } from 'react-native-reanimated';

// Allocated once, reused every frame.
const recorder = Skia.PictureRecorder();

function runBoardFrame(now: SharedValue<number>, dtMs: number | null): void {
  'worklet';
  now.set(now.get() + (dtMs ?? 0));
}

export function useBoardClock(now: SharedValue<number>): { readonly stop: () => void } {
  const callback = useFrameCallback((frame) => {
    runBoardFrame(now, frame.timeSincePreviousFrame);
    setScore(now.get());
  }, false);
  return {
    stop: () => {
      callback.setActive(false);
    },
  };
}

export const RECORDER = recorder;
