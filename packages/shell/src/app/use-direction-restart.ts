// packages/shell/src/app/use-direction-restart.ts
// The one way a screen flips the layout direction (S2 Continue, the S14 "Restart to apply"):
// the save is already written, then restartAfterAudio disposes audio, writes the guard, forces
// the direction and reloads; a failed dispose or restart lands in the error log. Call the
// returned function only from a handler.
import { useRef } from 'react';

import { restartAfterAudio } from '@e07/shell/app/restart-after-audio.ts';
import { useServices } from '@e07/shell/app/services-context.tsx';
import { useStores } from '@e07/shell/app/stores-context.tsx';
import { createSqliteKvDirectionGuardAdapter } from '@e07/shell/services/save/sqlite-kv-direction-guard-adapter.ts';

import type { Direction } from '@e07/shell/i18n/languages.ts';

export function useDirectionRestart(): (direction: Direction) => void {
  const { audio, errorLog } = useServices();
  const { restart: pending } = useStores();
  // A double tap disposes and reloads once; a restart that failed may be tried again.
  const isRestarting = useRef(false);
  return (direction) => {
    if (isRestarting.current) return;
    isRestarting.current = true;
    // Held from the tap: the route guards keep the current screen until the reload.
    pending.getState().begin(direction);
    const record = (error: unknown): void => {
      errorLog.record('boot', error);
    };
    const guard = createSqliteKvDirectionGuardAdapter();
    restartAfterAudio({ audio, guard, onDisposeError: record }, direction).catch(
      (error: unknown) => {
        isRestarting.current = false;
        pending.getState().cancel();
        record(error);
      },
    );
  };
}
