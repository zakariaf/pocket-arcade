// packages/shell/src/game-host/use-pause-on-background.ts
import { useIsFocused } from '@react-navigation/native';
import { useEffect, useEffectEvent, useRef } from 'react';

import { useIsAppActive } from '@e07/shell/app/use-is-app-active.ts';

import type { SessionStatus } from '@e07/shell/game-host/game-session-types.ts';

export type PauseInput = {
  readonly status: SessionStatus | 'missing';
  /** The app was in the foreground with the Game screen focused before this change. */
  readonly wasAway: boolean;
  readonly isAway: boolean;
};

/**
 * Spec S5: a playing run pauses at the moment the app leaves the foreground or the Game screen
 * loses focus. Only the change counts, so a run is never paused by the state it opened in.
 */
export function shouldPauseRun(input: PauseInput): boolean {
  return input.status === 'playing' && input.isAway && !input.wasAway;
}

/**
 * Mounted once by the Game screen. Pausing writes the run with its play time (the run writer
 * saves on 'pause'), and coming back shows the Pause menu, never a running game.
 */
export function usePauseOnBackground(status: SessionStatus | 'missing', pause: () => void): void {
  const isAppActive = useIsAppActive();
  const isFocused = useIsFocused();
  const isAway = !(isAppActive && isFocused);
  const wasAwayRef = useRef(isAway);
  const pauseIfDue = useEffectEvent((wasAway: boolean) => {
    if (shouldPauseRun({ status, wasAway, isAway })) pause();
  });
  useEffect(() => {
    pauseIfDue(wasAwayRef.current);
    wasAwayRef.current = isAway;
  }, [isAway]);
}
