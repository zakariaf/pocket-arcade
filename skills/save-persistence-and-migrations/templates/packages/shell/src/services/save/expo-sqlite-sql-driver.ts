// packages/shell/src/services/save/expo-sqlite-sql-driver.ts
// device-only: covered by the simulator kill test (kill-test.mjs); the same SQL runs on node:sqlite in test/integration/save.
import { openDatabaseSync } from 'expo-sqlite';

import type { ClosableSqlDriver, SqlRow } from '@e07/shell/services/save/sql-driver.ts';

/** Device driver. The file lives in <app>/Documents/SQLite/<fileName> (device backup, D5). */
export function createExpoSqliteSqlDriver(fileName: string): ClosableSqlDriver {
  const db = openDatabaseSync(fileName);
  return {
    exec: (sql) => {
      db.execSync(sql);
    },
    run: (sql, params) => {
      db.runSync(sql, [...params]);
    },
    get: (sql, params) => db.getFirstSync<SqlRow>(sql, [...params]),
    transaction: (work) => {
      db.withTransactionSync(work);
    },
    close: () => {
      db.closeSync();
    },
  };
}
