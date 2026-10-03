// packages/shell/src/services/save/sqlite-save-store.test.ts
// The store's own decisions over a scripted driver (the SQL itself runs on node:sqlite in
// test/integration/save/sqlite-save-store.test.ts): a row of an unknown shape reads as nothing,
// a save.db from a newer app is never touched, and a checkpoint truncates the WAL.
import { createSqliteSaveStore } from '@e07/shell/services/save/sqlite-save-store.ts';

import type { SqlDriver, SqlRow } from '@e07/shell/services/save/sql-driver.ts';

type Script = { readonly userVersion: number; readonly row: SqlRow | null };

function scriptedDriver(script: Script): SqlDriver & { readonly calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    exec: (sql) => {
      calls.push(`exec ${sql.slice(0, 12)}`);
    },
    run: (sql) => {
      calls.push(`run ${sql.slice(0, 12)}`);
    },
    get: (sql) => {
      calls.push(`get ${sql}`);
      if (sql === 'PRAGMA user_version') return { user_version: script.userVersion };
      return sql.trim().startsWith('SELECT') ? script.row : null;
    },
    transaction: (work) => {
      work();
    },
  };
}

describe('createSqliteSaveStore', () => {
  it('reads a row of an unknown shape as no row at all', () => {
    const driver = scriptedDriver({ userVersion: 1, row: { schema_version: '1', payload: 7 } });
    expect(createSqliteSaveStore(driver).read('current')).toBeNull();
  });

  it('leaves a save.db whose tables come from a newer app untouched', () => {
    const driver = scriptedDriver({ userVersion: 9, row: null });
    const store = createSqliteSaveStore(driver);
    const before = [...driver.calls];
    store.write({ current: null as never });
    store.quarantine('current', 'checksum', 1);
    store.checkpoint();
    expect(store.read('current')).toBeNull();
    expect(store.newerStructureVersion()).toBe(9);
    expect(driver.calls).toStrictEqual(before);
  });

  it('truncates the WAL on a checkpoint and reports tables it can use', () => {
    const driver = scriptedDriver({ userVersion: 1, row: null });
    const store = createSqliteSaveStore(driver);
    store.checkpoint();
    expect(driver.calls.at(-1)).toBe('get PRAGMA wal_checkpoint(TRUNCATE)');
    expect(store.newerStructureVersion()).toBeNull();
  });
});
