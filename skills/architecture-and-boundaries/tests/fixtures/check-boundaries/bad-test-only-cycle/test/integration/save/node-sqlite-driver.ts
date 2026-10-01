// test/integration/save/node-sqlite-driver.ts
import { DatabaseSync } from 'node:sqlite';

/** Jest runs the real SQL against node:sqlite. */
export function openTestDatabase(): DatabaseSync {
  return new DatabaseSync(':memory:');
}
