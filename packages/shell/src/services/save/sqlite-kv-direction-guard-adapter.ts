// packages/shell/src/services/save/sqlite-kv-direction-guard-adapter.ts
// Vendor code lives in adapters: this is the expo-sqlite/kv-store DirectionGuard. Its test runs the
// real kv-store SQL on node:sqlite (test/integration/save/sqlite-kv-direction-guard-adapter.test.ts).
import Storage from 'expo-sqlite/kv-store';

import type { DirectionGuard } from '@e07/shell/i18n/direction-guard.ts';

const KEY = 'shell.pending-direction-restart';

// Separate key-value database (expo-sqlite/kv-store), so the save document is not touched
// before the direction check. Sync API: safe to call before the first render.
export function createSqliteKvDirectionGuardAdapter(): DirectionGuard {
  return {
    readPending: () => {
      const value = Storage.getItemSync(KEY);
      return value === 'ltr' || value === 'rtl' ? value : null;
    },
    writePending: (direction) => {
      if (direction === null) Storage.removeItemSync(KEY);
      else Storage.setItemSync(KEY, direction);
    },
  };
}
