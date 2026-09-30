// test/integration/save/sqlite-kv-direction-guard-adapter.test.ts
// The pending-restart guard on the real expo-sqlite/kv-store code, whose SQL runs on node:sqlite:
// only expo-sqlite's native openDatabaseSync is replaced. It lives in the root test/ folder, the
// only place with Node types. The test reaches kv-store only through the adapter and its SQLite
// table (a direct expo-sqlite import would be a root dependency knip reports as unlisted).
import { createSqliteKvDirectionGuardAdapter } from '@e07/shell/services/save/sqlite-kv-direction-guard-adapter.ts';

import type { DatabaseSync, SQLInputValue } from 'node:sqlite';

type NodeSqlite = { readonly DatabaseSync: typeof DatabaseSync };

const KEY = 'shell.pending-direction-restart';
/** One database per file name, kept across a simulated JS reload (like the device's files). */
const mockDatabases = new Map<string, DatabaseSync>();

/** The part of expo-sqlite's SQLiteDatabase that kv-store uses, on node:sqlite. */
function mockOpenDatabaseSync(name: string): object {
  const sqlite = jest.requireActual<NodeSqlite>('node:sqlite');
  const db = mockDatabases.get(name) ?? new sqlite.DatabaseSync(':memory:');
  mockDatabases.set(name, db);
  return {
    execSync: (sql: string) => {
      db.exec(sql);
    },
    getFirstSync: (sql: string, ...params: SQLInputValue[]) => {
      const row = db.prepare(sql).get(...params);
      return row === undefined ? null : { ...row };
    },
    runSync: (sql: string, ...params: SQLInputValue[]) => {
      const result = db.prepare(sql).run(...params);
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    withTransactionSync: (work: () => void) => {
      db.exec('BEGIN');
      try {
        work();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    closeSync: () => {
      db.close();
    },
  };
}

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: (name: string) => mockOpenDatabaseSync(name),
}));

/** The row kv-store wrote, read straight from its SQLite table. */
function storedRow(): unknown {
  const db = mockDatabases.get('ExpoSQLiteStorage');
  return db?.prepare('SELECT value FROM storage WHERE key = ?').get(KEY)?.['value'] ?? null;
}

/** Writes a raw value into kv-store's table, as an older or damaged build might have left it. */
function storeRaw(value: string): void {
  createSqliteKvDirectionGuardAdapter().writePending(null); // kv-store creates its table
  mockDatabases
    .get('ExpoSQLiteStorage')
    ?.prepare('INSERT OR REPLACE INTO storage (key, value) VALUES (?, ?)')
    .run(KEY, value);
}

describe('sqlite-kv-direction-guard-adapter', () => {
  afterEach(() => {
    createSqliteKvDirectionGuardAdapter().writePending(null);
  });

  it('has no pending restart on a fresh install', () => {
    expect(createSqliteKvDirectionGuardAdapter().readPending()).toBeNull();
  });

  it('writes the pending direction into the kv-store table, not the save document', () => {
    createSqliteKvDirectionGuardAdapter().writePending('rtl');

    expect(storedRow()).toBe('rtl');
    expect(createSqliteKvDirectionGuardAdapter().readPending()).toBe('rtl');
  });

  it('keeps the marker across a JS reload (a fresh kv-store module on the same file)', () => {
    createSqliteKvDirectionGuardAdapter().writePending('ltr');

    jest.isolateModules(() => {
      const reloaded = jest.requireActual<{
        readonly createSqliteKvDirectionGuardAdapter: typeof createSqliteKvDirectionGuardAdapter;
      }>('@e07/shell/services/save/sqlite-kv-direction-guard-adapter.ts');
      expect(reloaded.createSqliteKvDirectionGuardAdapter().readPending()).toBe('ltr');
    });
  });

  it('clears the marker with null', () => {
    const guard = createSqliteKvDirectionGuardAdapter();
    guard.writePending('rtl');
    guard.writePending(null);

    expect(guard.readPending()).toBeNull();
    expect(storedRow()).toBeNull();
  });

  it('reads anything but ltr or rtl as no pending restart', () => {
    storeRaw('sideways');

    expect(createSqliteKvDirectionGuardAdapter().readPending()).toBeNull();
  });
});
