// test/integration/save/sqlite-save-store.test.ts
import { DatabaseSync } from 'node:sqlite';

describe('createSqliteSaveStore', () => {
  it('opens a database', () => {
    expect(new DatabaseSync(':memory:')).toBeDefined();
  });
});
