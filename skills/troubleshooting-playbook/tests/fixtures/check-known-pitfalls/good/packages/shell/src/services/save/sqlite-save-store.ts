// packages/shell/src/services/save/sqlite-save-store.ts (excerpt)
function prepareDatabase(driver: SqlDriver): number | null {
  const version = driver.get('PRAGMA user_version', [])?.['user_version'];
  if (typeof version === 'number' && version > DB_STRUCTURE_VERSION) return version; // read-only
  driver.exec(SAVE_DB_PRAGMAS);
  if (version === 0) driver.exec(SAVE_DB_DDL_V1);
  return null;
}
