// packages/shell/src/app/use-is-app-active.ts
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import type { AppStateStatus } from 'react-native';

/** True while the app is in the foreground ('active'); 'inactive' and 'background' are false. */
export function useIsAppActive(): boolean {
  const [appState, setAppState] = useState<AppStateStatus>(() =>
    AppState.currentState === 'active' ? 'active' : 'inactive',
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => {
      subscription.remove();
    };
  }, []);
  return appState === 'active';
}
