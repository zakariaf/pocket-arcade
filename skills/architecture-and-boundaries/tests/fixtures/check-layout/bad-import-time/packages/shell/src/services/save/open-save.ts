// packages/shell/src/services/save/open-save.ts
import { openDatabaseSync } from 'expo-sqlite';
import { createExpoSqliteSqlDriver } from './expo-sqlite-sql-driver.ts';

export const db = openDatabaseSync('save.db');
export const driver = createExpoSqliteSqlDriver(db);
