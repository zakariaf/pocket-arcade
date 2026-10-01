// packages/shell/src/services/save/sqlite-save-store.ts
import type { SaveStore } from './save-store.ts';

/** SQLite SaveStore. */
export function createSqliteSaveStore(): SaveStore {
  return { checkpoint: () => undefined };
}
