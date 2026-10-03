// test/integration/save/node-sqlite-sql-driver.ts
import { DatabaseSync } from 'node:sqlite';

import type { ClosableSqlDriver } from '@e07/shell/services/save/sql-driver.ts';

/** Node 26 built-in SQLite: runs the Shell's real save SQL in Jest (root test/: Node types). */
export function createNodeSqliteSqlDriver(path: string): ClosableSqlDriver {
  const db = new DatabaseSync(path);
  return {
    exec: (sql) => {
      db.exec(sql);
    },
    run: (sql, params) => {
      db.prepare(sql).run(...params);
    },
    get: (sql, params) => {
      const row = db.prepare(sql).get(...params);
      // node:sqlite returns null-prototype objects; copy so toStrictEqual compares plain rows.
      return row === undefined ? null : { ...row };
    },
    transaction: (work) => {
      db.exec('BEGIN');
      try {
        work();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    close: () => {
      db.close();
    },
  };
}
