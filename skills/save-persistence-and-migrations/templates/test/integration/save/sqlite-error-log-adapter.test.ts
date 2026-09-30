// test/integration/save/sqlite-error-log-adapter.test.ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createSqliteErrorLogAdapter } from '@e07/shell/services/error-log/sqlite-error-log-adapter.ts';
import { createSqliteSaveStore } from '@e07/shell/services/save/sqlite-save-store.ts';

import { createNodeSqliteSqlDriver } from './node-sqlite-sql-driver.ts';

describe('sqlite-error-log-adapter', () => {
  let dir = '';
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'error-log-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('lists recorded errors newest first with their source and time', () => {
    const driver = createNodeSqliteSqlDriver(join(dir, 'save.db'));
    createSqliteSaveStore(driver); // creates the tables, error_log included
    let now = 100;
    const log = createSqliteErrorLogAdapter(driver, { nowMs: () => now });
    log.record('save', new Error('disk full'));
    now = 200;
    log.record('ads', 'no fill');

    expect(log.entries()).toStrictEqual([
      { atMs: 200, source: 'ads', message: 'no fill' },
      { atMs: 100, source: 'save', message: 'disk full' },
    ]);
    driver.close();
  });

  it('keeps only the newest 200 rows', () => {
    const driver = createNodeSqliteSqlDriver(join(dir, 'save.db'));
    createSqliteSaveStore(driver);
    const log = createSqliteErrorLogAdapter(driver, { nowMs: () => 1 });
    for (let index = 0; index < 205; index += 1) log.record('boot', `error ${String(index)}`);

    expect(log.entries()).toHaveLength(200);
    expect(log.entries()[0]?.message).toBe('error 204');
    driver.close();
  });

  it('swallows errors before the tables exist (never throws)', () => {
    const driver = createNodeSqliteSqlDriver(join(dir, 'save.db'));
    const log = createSqliteErrorLogAdapter(driver, { nowMs: () => 1 });

    expect(() => {
      log.record('boot', new Error('early'));
    }).not.toThrow();
    expect(log.entries()).toStrictEqual([]);
    driver.close();
  });
});
