// packages/shell/src/ui/use-hold-to-confirm.ts
import {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { SharedValue } from 'react-native-reanimated';

/** Spec S11 DATA: "Reset all progress" = hold the button for 2 seconds. */
export const HOLD_TO_CONFIRM_MS = 2000;

export type HoldToConfirm = {
  /** 0..1 fill for the button background; read it in an animated style. */
  readonly progress: SharedValue<number>;
  readonly handlePressIn: () => void;
  readonly handlePressOut: () => void;
};

export function useHoldToConfirm(onConfirm: () => void): HoldToConfirm {
  const progress = useSharedValue(0);
  const handlePressIn = (): void => {
    // A safety timer, not decoration: it must never be skipped by Reduce motion.
    const config = {
      duration: HOLD_TO_CONFIRM_MS,
      easing: Easing.linear,
      reduceMotion: ReduceMotion.Never,
    };
    progress.set(
      withTiming(1, config, (isFinished) => {
        if (isFinished === true) scheduleOnRN(onConfirm);
      }),
    );
  };
  const handlePressOut = (): void => {
    cancelAnimation(progress);
    progress.set(withTiming(0, { duration: 150 }));
  };
  return { progress, handlePressIn, handlePressOut };
}
