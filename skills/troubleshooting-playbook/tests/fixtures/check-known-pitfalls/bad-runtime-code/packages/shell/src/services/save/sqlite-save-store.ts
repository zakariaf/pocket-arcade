// packages/shell/src/services/save/sqlite-save-store.ts (excerpt)
function prepareDatabase(driver: SqlDriver): void {
  driver.exec(SAVE_DB_PRAGMAS);
  const version = driver.get('PRAGMA user_version', [])?.['user_version'];
  if (typeof version === 'number' && version > DB_STRUCTURE_VERSION) {
    throw new Error(`save.db structure v${String(version)} is newer than this app`);
  }
}
