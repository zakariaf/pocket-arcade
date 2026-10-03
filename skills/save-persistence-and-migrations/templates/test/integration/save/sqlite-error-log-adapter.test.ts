// test/integration/save/sqlite-error-log-adapter.test.ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createSqliteErrorLogAdapter } from '@e07/shell/services/error-log/sqlite-error-log-adapter.ts';
import { createSqliteSaveStore } from '@e07/shell/services/save/sqlite-save-store.ts';

import { createNodeSqliteSqlDriver } from './node-sqlite-sql-driver.ts';

// spec 8.14: "No crash reporting service (N2). The Shell keeps a small local error log (the
// debug menu can show it) and recovers where possible ... never a crash loop."
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

  // N10: "a save from a newer app version is never touched."
  it('writes nothing into a save.db whose tables come from a newer app', () => {
    const driver = createNodeSqliteSqlDriver(join(dir, 'save.db'));
    createSqliteSaveStore(driver);
    for (let index = 1; index <= 200; index += 1) {
      driver.run('INSERT INTO error_log (at_ms, area, message) VALUES (?, ?, ?)', [
        index,
        'boot',
        `newer ${String(index)}`,
      ]);
    }
    driver.exec('PRAGMA user_version = 2');
    const log = createSqliteErrorLogAdapter(driver, { nowMs: () => 999 });
    log.record('save', new Error('should not be written'));

    expect(
      driver.get('SELECT COUNT(*) AS n, MIN(id) AS low, MAX(at_ms) AS last FROM error_log', []),
    ).toStrictEqual({ n: 200, low: 1, last: 200 });
    expect(log.entries()[0]?.message).toBe('newer 200');
    driver.close();
  });
});
