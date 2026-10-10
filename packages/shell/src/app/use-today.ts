// packages/shell/src/app/use-today.ts
import { useIsFocused } from '@react-navigation/native';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { useServices } from '@e07/shell/app/services-context.tsx';

import type { DateKey } from '@e07/game-kit/dates/date-key.ts';

function subscribeToAppState(onChange: () => void): () => void {
  const subscription = AppState.addEventListener('change', onChange);
  return () => {
    subscription.remove();
  };
}

/**
 * "Today" is read, never cached (spec S9: the day changes at local midnight): the value is
 * read from ClockPort on every render, the screen re-renders when it gains focus, and when
 * the app comes back to the foreground.
 */
export function useToday(): DateKey {
  const { clock } = useServices();
  useIsFocused(); // subscribes to focus changes, so returning to the screen re-reads the day
  return useSyncExternalStore(subscribeToAppState, () => clock.today());
}
