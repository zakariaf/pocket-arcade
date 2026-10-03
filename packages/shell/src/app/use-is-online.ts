// packages/shell/src/app/use-is-online.ts
// The ConnectivityPort as a React value: the last report (false until the first one), re-rendering
// when it changes. Model hooks use it for the banner and the store price; nothing polls.
import { useSyncExternalStore } from 'react';

import { useServices } from '@e07/shell/app/services-context.tsx';

export function useIsOnline(): boolean {
  const { connectivity } = useServices();
  return useSyncExternalStore(connectivity.subscribe, connectivity.isOnline);
}
