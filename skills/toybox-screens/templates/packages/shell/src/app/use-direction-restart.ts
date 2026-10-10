// packages/shell/src/app/use-direction-restart.ts
// The one way a screen flips the layout direction (S2 Continue, the S14 "Restart to apply"):
// the save is already written, then restartAfterAudio disposes audio, writes the guard, forces
// the direction and reloads; a failed dispose or restart lands in the error log. Call the
// returned function only from a handler.
import { restartAfterAudio } from '@e07/shell/app/restart-after-audio.ts';
import { useServices } from '@e07/shell/app/services-context.tsx';
import { createSqliteKvDirectionGuardAdapter } from '@e07/shell/services/save/sqlite-kv-direction-guard-adapter.ts';

import type { Direction } from '@e07/shell/i18n/languages.ts';

export function useDirectionRestart(): (direction: Direction) => void {
  const { audio, errorLog } = useServices();
  return (direction) => {
    const record = (error: unknown): void => {
      errorLog.record('boot', error);
    };
    const guard = createSqliteKvDirectionGuardAdapter();
    restartAfterAudio({ audio, guard, onDisposeError: record }, direction).catch(record);
  };
}
