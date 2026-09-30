// packages/shell/src/services/save/expo-sqlite-sql-driver.ts
// device-only: covered by the simulator kill test; Jest runs the same SQL through the node:sqlite driver.
import { openDatabaseSync } from 'expo-sqlite';

export function createExpoSqliteSqlDriver(fileName: string): { readonly close: () => void } {
  const db = openDatabaseSync(fileName);
  return { close: () => db.closeSync() };
}
