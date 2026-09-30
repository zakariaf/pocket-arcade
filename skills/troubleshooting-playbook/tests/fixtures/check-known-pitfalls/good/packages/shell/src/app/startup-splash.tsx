// packages/shell/src/app/startup-splash.tsx
import { reloadAppAsync } from 'expo';
import { useEffect } from 'react';

export function useDirectionReload(mustReload: boolean): void {
  useEffect(() => {
    // The reload runs from the mounted splash, never during bundle evaluation.
    if (mustReload) void reloadAppAsync('direction');
  }, [mustReload]);
}
