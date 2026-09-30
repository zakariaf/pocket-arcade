// packages/shell/src/ui/use-hold-to-confirm.ts
import {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { MOTION_MS } from '@e07/shell/theme/motion.ts';

import type { SharedValue } from 'react-native-reanimated';

/** Spec S11: "Reset all progress" = hold the button for 2 seconds. */
export const HOLD_TO_CONFIRM_MS = MOTION_MS.holdToConfirm;
const EMPTY_MS = 150;

export type HoldToConfirm = {
  /** 0..1 fill for the button background; read it in an animated style. */
  readonly progress: SharedValue<number>;
  readonly handlePressIn: () => void;
  readonly handlePressOut: () => void;
};

/** A frozen fill stays between empty (0) and full (1). */
function clampUnit(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/**
 * The 2 s hold behind a danger key. `frozenProgress` (0 to 1, read at mount) holds the fill at
 * that value with no timer, so a press neither fills nor confirms: the parity capture of the reset
 * dialog shows it 46 % held, as the design draws it. VoiceOver's activate action still confirms.
 */
export function useHoldToConfirm(onConfirm: () => void, frozenProgress?: number): HoldToConfirm {
  const isFrozen = frozenProgress !== undefined;
  const progress = useSharedValue(isFrozen ? clampUnit(frozenProgress) : 0);
  const handlePressIn = (): void => {
    if (isFrozen) return;
    // A safety timer, not decoration: it must never be skipped by Reduce motion.
    const config = {
      duration: HOLD_TO_CONFIRM_MS,
      easing: Easing.linear,
    };
    progress.set(
      withTiming(1, config, (isFinished) => {
        if (isFinished === true) scheduleOnRN(onConfirm);
      }),
    );
  };
  const handlePressOut = (): void => {
    if (isFrozen) return;
    cancelAnimation(progress);
    progress.set(withTiming(0, { duration: EMPTY_MS }));
  };
  return { progress, handlePressIn, handlePressOut };
}
