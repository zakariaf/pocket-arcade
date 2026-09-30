// packages/shell/src/services/error-log/sqlite-error-log-adapter.ts
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

function isEntry(value: unknown): value is ErrorLogEntry {
  return typeof value === 'object' && value !== null && 'atMs' in value && 'source' in value;
}

/** Ring buffer in save.db's error_log table (newest 200 rows); never leaves the device (N2). */
export function createSqliteErrorLogAdapter(
  driver: SqlDriver,
  clock: Pick<ClockPort, 'nowMs'>,
): ErrorLogPort {
  const insert = (source: ErrorSource, error: unknown): void => {
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
