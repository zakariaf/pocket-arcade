import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createSqliteSaveStore } from '@e07/shell/services/save/sqlite-save-store.ts';

import { createNodeSqliteSqlDriver } from './node-sqlite-sql-driver.ts';

describe('createSqliteSaveStore', () => {
  it('reads back what it wrote', () => {
    const driver = createNodeSqliteSqlDriver(join(mkdtempSync(join(tmpdir(), 'save-')), 'save.db'));
    const store = createSqliteSaveStore(driver);
    store.write('current', 'x');
    expect(store.read('current')).toBe('x');
  });
});
