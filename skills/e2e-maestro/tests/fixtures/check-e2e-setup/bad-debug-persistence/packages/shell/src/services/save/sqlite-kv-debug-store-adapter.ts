// packages/shell/src/services/save/sqlite-kv-debug-store-adapter.ts
// device-only: covered by test/integration/save/sqlite-kv-debug-store-adapter.test.ts (node:sqlite)
// and flows/journeys/02-core-journey-offline.yaml (the date and offline flags survive a kill).
// Test builds only: the debug overrides live in expo-sqlite/kv-store's own small database (like the
// direction guard), never in the save document. Reached only through the test-only entry
// (TEST_ONLY.createSqliteKvDebugStoreAdapter), so a store bundle never contains this file.
import Storage from 'expo-sqlite/kv-store';

import type { DebugStore } from '@e07/shell/screens/debug/debug-overrides.ts';

// Sync API: the composition root reads the overrides before the first render.
export function createSqliteKvDebugStoreAdapter(): DebugStore {
  return {
    get: (key) => null,
    set: (key, value) => {
      if (value === null) Storage.removeItemSync(key);
      else Storage.setItemSync(key, value);
    },
  };
}
