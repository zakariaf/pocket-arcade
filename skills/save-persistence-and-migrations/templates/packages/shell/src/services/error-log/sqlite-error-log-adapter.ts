// packages/shell/src/services/error-log/sqlite-error-log-adapter.ts
import { DB_STRUCTURE_VERSION } from '@e07/shell/services/save/save-db-schema.ts';

import type { ClockPort } from '@e07/shell/services/clock/clock-port.ts';
import type {
  ErrorLogEntry,
  ErrorLogPort,
  ErrorSource,
} from '@e07/shell/services/error-log/error-log-port.ts';
import type { SqlDriver } from '@e07/shell/services/save/sql-driver.ts';

const KEEP_ROWS = 200;
const LIST_SQL = `
SELECT json_group_array(json_object('atMs', at_ms, 'source', area, 'message', message)) AS rows
FROM (SELECT * FROM error_log ORDER BY id DESC LIMIT ?)`;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** save.db's tables come from a newer app: never write into them (N10, like the save store). */
function isNewerStructure(driver: SqlDriver): boolean {
  const version = driver.get('PRAGMA user_version', [])?.['user_version'];
  return typeof version === 'number' && version > DB_STRUCTURE_VERSION;
}

function isEntry(value: unknown): value is ErrorLogEntry {
  return typeof value === 'object' && value !== null && 'atMs' in value && 'source' in value;
}

/**
 * Ring buffer in save.db's error_log table (newest 200 rows); never leaves the device (N2).
 * A save.db from a newer app is read only: `record` does nothing there.
 */
export function createSqliteErrorLogAdapter(
  driver: SqlDriver,
  clock: Pick<ClockPort, 'nowMs'>,
): ErrorLogPort {
  const insert = (source: ErrorSource, error: unknown): void => {
    if (isNewerStructure(driver)) return;
    driver.run('INSERT INTO error_log (at_ms, area, message, details) VALUES (?, ?, ?, NULL)', [
      clock.nowMs(),
      source,
      messageOf(error),
    ]);
    driver.run('DELETE FROM error_log WHERE id <= (SELECT MAX(id) FROM error_log) - ?', [
      KEEP_ROWS,
    ]);
  };
  return {
    record: (source, error) => {
      try {
        insert(source, error);
      } catch {
        // The error log must never crash the app.
      }
    },
    entries: () => {
      try {
        const json = driver.get(LIST_SQL, [KEEP_ROWS])?.['rows'];
        const rows: unknown = typeof json === 'string' ? JSON.parse(json) : [];
        return Array.isArray(rows) ? rows.filter(isEntry) : [];
      } catch {
        return []; // no table yet, or a save.db from a newer app: the debug view shows nothing
      }
    },
  };
}

/**
 * Empties the error_log table: a parity capture (test builds) starts from no error, as it starts
 * from no saved debug flag, so S15 shows the design's 0 whatever earlier launches logged. A save.db
 * from a newer app is left alone (N10), and like `record` it never throws.
 */
export function clearErrorLog(driver: SqlDriver): void {
  try {
    if (isNewerStructure(driver)) return;
    driver.run('DELETE FROM error_log', []);
  } catch {
    // No table yet: nothing to empty.
  }
}
