// test/integration/save/sqlite-save-store.test.ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { planLoad } from '@e07/shell/services/save/load-plan.ts';
import { encodeSaveDoc } from '@e07/shell/services/save/save-codec.ts';
import { createSaveService } from '@e07/shell/services/save/save-service.ts';
import { createDefaultSaveDoc } from '@e07/shell/services/save/schema/default-save-doc.ts';
import { createSqliteSaveStore } from '@e07/shell/services/save/sqlite-save-store.ts';

import { createNodeSqliteSqlDriver } from './node-sqlite-sql-driver.ts';

const META = { appVersion: '1.0.0', writtenAtMs: 1_790_000_000_000, writeCount: 1 };

describe('sqlite-save-store', () => {
  let dir = '';
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'save-sql-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('uses WAL and synchronous FULL', () => {
    const driver = createNodeSqliteSqlDriver(join(dir, 'save.db'));
    driver.exec('PRAGMA synchronous = NORMAL'); // node:sqlite already defaults to FULL (2)
    createSqliteSaveStore(driver);
    expect(driver.get('PRAGMA journal_mode', [])).toStrictEqual({ journal_mode: 'wal' });
    expect(driver.get('PRAGMA synchronous', [])).toStrictEqual({ synchronous: 2 });
    driver.close();
  });

  it('reloads a document written to current and backup', () => {
    const path = join(dir, 'save.db');
    const store = createSqliteSaveStore(createNodeSqliteSqlDriver(path));
    const record = encodeSaveDoc(createDefaultSaveDoc('line-siege'), META);
    store.write({ current: record, backup: record });
    const reopened = createSqliteSaveStore(createNodeSqliteSqlDriver(path));
    const plan = planLoad({
      current: reopened.read('current'),
      backup: reopened.read('backup'),
      gameId: 'line-siege',
    });
    expect(plan.outcome).toStrictEqual({ kind: 'loaded' });
    expect(plan.doc).toStrictEqual(createDefaultSaveDoc('line-siege'));
  });

  it('restores the backup when current is corrupted and quarantines current', () => {
    const driver = createNodeSqliteSqlDriver(join(dir, 'save.db'));
    const store = createSqliteSaveStore(driver);
    const record = encodeSaveDoc(createDefaultSaveDoc('line-siege'), META);
    store.write({ current: { ...record, payload: '{"broken":' }, backup: record });
    const plan = planLoad({
      current: store.read('current'),
      backup: store.read('backup'),
      gameId: 'line-siege',
    });
    expect(plan.outcome).toStrictEqual({ kind: 'restored-from-backup', reason: 'checksum' });
    store.quarantine('current', 'checksum', 1);
    expect(driver.get('SELECT COUNT(*) AS n FROM save_quarantine', [])).toStrictEqual({ n: 1 });
  });

  it('rolls back a failed transaction', () => {
    const driver = createNodeSqliteSqlDriver(join(dir, 'save.db'));
    const store = createSqliteSaveStore(driver);
    const record = encodeSaveDoc(createDefaultSaveDoc('line-siege'), META);
    store.write({ current: record });
    expect(() => {
      driver.transaction(() => {
        driver.run('UPDATE save_slots SET payload = ? WHERE slot = ?', ['x', 'current']);
        throw new Error('crash mid-write');
      });
    }).toThrow('crash mid-write');
    expect(store.read('current')?.payload).toBe(record.payload);
  });

  it('checkpoints the WAL into the main file', () => {
    const driver = createNodeSqliteSqlDriver(join(dir, 'save.db'));
    const store = createSqliteSaveStore(driver);
    store.write({ current: encodeSaveDoc(createDefaultSaveDoc('line-siege'), META) });
    store.checkpoint();
    expect(driver.get('PRAGMA wal_checkpoint(PASSIVE)', [])).toStrictEqual({
      busy: 0,
      log: 0,
      checkpointed: 0,
    });
  });

  it('opens a save.db from a newer app without a crash and never writes it', () => {
    const path = join(dir, 'save.db');
    const newerApp = createNodeSqliteSqlDriver(path);
    newerApp.exec(
      'CREATE TABLE save_slots_v2 (slot TEXT PRIMARY KEY) STRICT; PRAGMA user_version = 2;',
    );
    newerApp.close();

    const driver = createNodeSqliteSqlDriver(path);
    const store = createSqliteSaveStore(driver);
    const plan = planLoad({
      current: store.read('current'),
      backup: store.read('backup'),
      gameId: 'line-siege',
      newerStructure: store.newerStructureVersion(),
    });
    const errorLog = { record: () => undefined, entries: () => [] };
    const deps = {
      store,
      clock: { nowMs: () => 1 },
      errorLog,
      appVersion: '1.0.0',
      isStrict: true,
    };
    const save = createSaveService(deps, plan, 0);
    save.applyLoadWrites();
    save.update((doc) => ({ ...doc, settings: { ...doc.settings, theme: 'dark' } }), {
      refreshBackup: true,
    });
    store.checkpoint();

    expect(plan.outcome).toStrictEqual({ kind: 'newer-version', found: 2 });
    expect(save.doc().settings.theme).toBe('dark');
    expect(driver.get('PRAGMA user_version', [])).toStrictEqual({ user_version: 2 });
    expect(
      driver.get("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'save_slots'", []),
    ).toStrictEqual({ n: 0 });
    expect(driver.get('PRAGMA journal_mode', [])).toStrictEqual({ journal_mode: 'delete' });
    driver.close();
  });
});
