// packages/shell/src/services/save/peek-current-save.ts
// device-only: covered by the RTL language-switch flow, which restarts the app into the saved language.
import { createExpoSqliteSqlDriver } from '@e07/shell/services/save/expo-sqlite-sql-driver.ts';
import { SAVE_DB_FILE, SELECT_SLOT_SQL } from '@e07/shell/services/save/save-db-schema.ts';

/**
 * The startup language peek: the parsed `current` payload, or null. Read-only: no DDL, no
 * validation, no migration, no write (a direction reload may follow). Never throws.
 */
export function peekCurrentSave(): unknown {
  const driver = createExpoSqliteSqlDriver(SAVE_DB_FILE);
  try {
    const payload = driver.get(SELECT_SLOT_SQL, ['current'])?.['payload'];
    return typeof payload === 'string' ? (JSON.parse(payload) as unknown) : null;
  } catch {
    return null; // first launch (no table yet) or an unreadable row: the full load decides
  } finally {
    driver.close();
  }
}
