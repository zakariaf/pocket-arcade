// packages/shell/src/app/use-direction-restart.ts
// The one way a screen flips the layout direction (S2 Continue, the S14 "Restart to apply"):
// the save is already written, then restartAfterAudio disposes audio, writes the guard, forces
// the direction and reloads; a failed dispose or restart lands in the error log. The restart
// store alone blocks a second reload (a double tap, or a tap on another screen's instance of this
// hook); a restart that failed lets go of it. Call the returned function only from a handler.
import { restartAfterAudio } from '@e07/shell/app/restart-after-audio.ts';
import { useServices } from '@e07/shell/app/services-context.tsx';
import { useStores } from '@e07/shell/app/stores-context.tsx';
import { createSqliteKvDirectionGuardAdapter } from '@e07/shell/services/save/sqlite-kv-direction-guard-adapter.ts';

import type { Direction } from '@e07/shell/i18n/languages.ts';

export function useDirectionRestart(): (direction: Direction) => void {
  const { audio, errorLog } = useServices();
  const { restart: pending } = useStores();
  return (direction) => {
    // Held from the tap: the route guards keep the current screen until the reload. A restart
    // already pending (this tap's twin, or another screen's) refuses this one.
    if (!pending.getState().begin(direction)) return;
    const record = (error: unknown): void => {
      errorLog.record('boot', error);
    };
    const guard = createSqliteKvDirectionGuardAdapter();
    restartAfterAudio({ audio, guard, onDisposeError: record }, direction).catch(
      (error: unknown) => {
        pending.getState().cancel();
        record(error);
      },
    );
  };
}
