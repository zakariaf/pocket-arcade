// packages/shell/src/app/use-direction-restart.ts
// The one way a screen flips the layout direction (S2 Continue, the S14 "Restart to apply"):
// the save is already written, audio is disposed, then restartForDirection writes the guard,
// forces the direction and reloads. Call the returned function only from a handler.
import { useServices } from '@e07/shell/app/services-context.tsx';
import { restartForDirection } from '@e07/shell/i18n/direction.ts';
import { createSqliteKvDirectionGuardAdapter } from '@e07/shell/services/save/sqlite-kv-direction-guard-adapter.ts';

import type { Direction } from '@e07/shell/i18n/languages.ts';

export function useDirectionRestart(): (direction: Direction) => void {
  const { audio, errorLog } = useServices();
  return (direction) => {
    audio
      .dispose()
      .then(() => restartForDirection(direction, createSqliteKvDirectionGuardAdapter()))
      .catch((error: unknown) => {
        errorLog.record('boot', error);
      });
  };
}
