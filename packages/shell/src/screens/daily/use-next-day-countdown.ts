// packages/shell/src/screens/daily/use-next-day-countdown.ts
import { useSyncExternalStore } from 'react';

import { useServices } from '@e07/shell/app/services-context.tsx';
import { subscribeToAppState } from '@e07/shell/app/use-today.ts';
import { countdownOf, minutesLeftOf } from '@e07/shell/screens/daily/daily-summary.ts';

import type { Countdown } from '@e07/shell/screens/daily/daily-summary.ts';

/** How often the countdown re-reads the clock: the minute shown is at most 15 s late. */
export const COUNTDOWN_REFRESH_MS = 15_000;

function subscribeToTicks(onChange: () => void): () => void {
  const timer = setInterval(onChange, COUNTDOWN_REFRESH_MS);
  const unsubscribeFromAppState = subscribeToAppState(onChange);
  return () => {
    clearInterval(timer);
    unsubscribeFromAppState();
  };
}

/** While no countdown is on screen nothing ticks: no interval and no AppState listener. */
function subscribeToNothing(): () => void {
  return () => undefined;
}

/**
 * S9's "Next challenge in {h} h {m} min" after today's game: the time left until local
 * midnight, from ClockPort.msUntilNextLocalDay() (never Date in a screen). The snapshot is
 * whole minutes, so it only changes once a minute and React re-renders only then. It ticks only
 * while `isShown` (today's result on a focused S9); otherwise it is read on each render alone.
 */
export function useNextDayCountdown(isShown = true): Countdown {
  const { clock } = useServices();
  const minutesLeft = useSyncExternalStore(isShown ? subscribeToTicks : subscribeToNothing, () =>
    minutesLeftOf(clock.msUntilNextLocalDay()),
  );
  return countdownOf(minutesLeft);
}
