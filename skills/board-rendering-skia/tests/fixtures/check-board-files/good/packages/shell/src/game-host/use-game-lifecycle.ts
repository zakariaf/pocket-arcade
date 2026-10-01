// packages/shell/src/game-host/use-game-lifecycle.ts
import { useEffect, useEffectEvent } from 'react';

import { useIsAppActive } from '@e07/shell/app/use-is-app-active.ts';

export type LifecycleInput = {
  /** From React Navigation's useIsFocused() on the Game screen. */
  readonly isFocused: boolean;
  /** From the ads store: an interstitial or rewarded ad is on screen. */
  readonly isFullscreenAdShowing: boolean;
  /** Stop frame callbacks, suspend audio, cancel cues; real-time games also save and auto-pause. */
  readonly onPause: () => void;
  /** Resume audio; turn-based clocks finish the interrupted timeline; real-time stays paused (S6). */
  readonly onResume: () => void;
  /** Test builds: any of the three facts changed (the board-clock trace), before onPause/onResume. */
  readonly onFlags?: (flags: RunnableFlags) => void;
};

/** The three facts behind the decision (the board-clock trace records them). */
export type RunnableFlags = {
  readonly isAppActive: boolean;
  readonly isFocused: boolean;
  readonly isAdShowing: boolean;
};

/** ONE place that decides whether the board may run: app active AND screen focused AND no ad. */
export function useGameLifecycle(input: LifecycleInput): void {
  const isAppActive = useIsAppActive();
  const isRunnable = isAppActive && input.isFocused && !input.isFullscreenAdShowing;
  const { isFocused, isFullscreenAdShowing: isAdShowing } = input;
  const handleFlags = useEffectEvent((flags: RunnableFlags) => {
    input.onFlags?.(flags);
  });
  const handleChange = useEffectEvent((isNowRunnable: boolean) => {
    if (isNowRunnable) input.onResume();
    else input.onPause();
  });
  // Declared first: effects run in order, so a trace sees the facts before the decision.
  useEffect(() => {
    handleFlags({ isAppActive, isFocused, isAdShowing });
  }, [isAppActive, isFocused, isAdShowing]);
  useEffect(() => {
    handleChange(isRunnable);
  }, [isRunnable]);
}
