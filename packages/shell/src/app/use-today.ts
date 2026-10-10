// packages/shell/src/app/use-today.ts
import { useIsFocused } from '@react-navigation/native';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { useServices } from '@e07/shell/app/services-context.tsx';

import type { DateKey } from '@e07/game-kit/dates/date-key.ts';
import type { ClockPort } from '@e07/shell/services/clock/clock-port.ts';

/** useSyncExternalStore's subscribe: runs onChange whenever the app changes state (foreground). */
export function subscribeToAppState(onChange: () => void): () => void {
  const subscription = AppState.addEventListener('change', onChange);
  return () => {
    subscription.remove();
  };
}

/**
 * useSyncExternalStore's subscribe for the day: the foreground, and each local midnight
 * (ClockPort.msUntilNextLocalDay(), which knows the time zone and daylight saving), so a screen
 * left open across midnight shows the new day without a tap.
 */
function subscribeToDayOf(clock: ClockPort): (onChange: () => void) => () => void {
  return (onChange) => {
    let timer = setTimeout(tick, clock.msUntilNextLocalDay());
    function tick(): void {
      onChange();
      timer = setTimeout(tick, clock.msUntilNextLocalDay());
    }
    const unsubscribeFromAppState = subscribeToAppState(onChange);
    return () => {
      clearTimeout(timer);
      unsubscribeFromAppState();
    };
  };
}

/**
 * "Today" is read, never cached (spec S9: the day changes at local midnight): the value is
 * read from ClockPort on every render, the screen re-renders when it gains focus, when the
 * app comes back to the foreground, and at local midnight while it stays open.
 */
export function useToday(): DateKey {
  const { clock } = useServices();
  useIsFocused(); // subscribes to focus changes, so returning to the screen re-reads the day
  return useSyncExternalStore(subscribeToDayOf(clock), () => clock.today());
}
