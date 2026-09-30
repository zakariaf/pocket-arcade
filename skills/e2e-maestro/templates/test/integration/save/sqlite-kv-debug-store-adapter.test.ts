// test/integration/save/sqlite-kv-debug-store-adapter.test.ts
// The debug flags' key-value store on the real expo-sqlite/kv-store code, whose SQL runs on
// node:sqlite: only expo-sqlite's native openDatabaseSync is replaced. A "reload" is a fresh
// kv-store module over the same database file, as after reloadAppAsync or a killed app. It lives in
// the root test/ folder, the only place with Node types.
import { createDebugServices } from '@e07/shell/screens/debug/debug-services.ts';
import { createSimulatedClock } from '@e07/shell/screens/debug/simulated-clock.ts';
import { createSimulatedConnectivity } from '@e07/shell/screens/debug/simulated-connectivity.ts';
import { createFakeClock } from '@e07/shell/services/clock/fake-clock.ts';
import { createFakeConnectivity } from '@e07/shell/services/connectivity/fake-connectivity.ts';
import { createSqliteKvDebugStoreAdapter } from '@e07/shell/services/save/sqlite-kv-debug-store-adapter.ts';

import type { DebugServices } from '@e07/shell/screens/debug/debug-services.ts';
import type { SimulatedClock } from '@e07/shell/screens/debug/simulated-clock.ts';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';

type NodeSqlite = { readonly DatabaseSync: typeof DatabaseSync };
type AdapterModule = {
  readonly createSqliteKvDebugStoreAdapter: typeof createSqliteKvDebugStoreAdapter;
};

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
jest.mock('react-native-google-mobile-ads');

type Run = { readonly services: DebugServices; readonly clock: SimulatedClock };

/** One JS run of a test build: fresh services over the key-value store a module gives. */
function startRun(adapter: AdapterModule = { createSqliteKvDebugStoreAdapter }): Run {
  const clock = createSimulatedClock(createFakeClock({ nowMs: 0, today: '2026-09-28' }));
  const services = createDebugServices({
    connectivity: createSimulatedConnectivity(createFakeConnectivity(true)),
    clock,
    store: adapter.createSqliteKvDebugStoreAdapter(),
    perfLog: { append: jest.fn(), entries: () => [] },
    persistPremium: jest.fn(),
    dispatchPremium: jest.fn(),
    nowMs: () => 0,
    adsMode: 'off',
    onError: jest.fn(),
  });
  return { services, clock };
}

describe('sqlite-kv-debug-store-adapter', () => {
  afterEach(() => {
    const store = createSqliteKvDebugStoreAdapter();
    store.set('debug.overrides', null);
    store.set('debug.pending-screen', null);
  });

  it('starts empty, and clears a key with null', () => {
    const store = createSqliteKvDebugStoreAdapter();
    expect(store.get('debug.pending-screen')).toBeNull();
    store.set('debug.pending-screen', '{"screen":"levels"}');
    expect(store.get('debug.pending-screen')).toBe('{"screen":"levels"}');
    store.set('debug.pending-screen', null);
    expect(store.get('debug.pending-screen')).toBeNull();
  });

  it('keeps the debug date and flags across a JS reload, outside the save document', () => {
    const first = startRun();
    first.services.setDate('2026-09-26');
    first.services.setOffline(true);
    first.services.setBoardLayout(true);

    jest.isolateModules(() => {
      const reloaded = startRun(
        jest.requireActual<AdapterModule>(
          '@e07/shell/services/save/sqlite-kv-debug-store-adapter.ts',
        ),
      );
      expect(reloaded.clock.today()).toBe('2026-09-26');
      expect(reloaded.services.isOffline()).toBe(true);
      expect(reloaded.services.isBoardLayoutOn()).toBe(true);
    });
    expect([...mockDatabases.keys()]).toStrictEqual(['ExpoSQLiteStorage']);
  });
});
