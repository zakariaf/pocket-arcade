// packages/shell/src/services/save/save-db-schema.ts
/** File name inside expo-sqlite's default directory (Documents/SQLite). */
export const SAVE_DB_FILE = 'save.db';

/** Table structure version (PRAGMA user_version). NOT the document schemaVersion. */
export const DB_STRUCTURE_VERSION = 1;

/**
 * Run on every open. journal_mode is stored in the file; synchronous is per
 * connection, so both are always set. FULL: a committed move survives power loss.
 */
export const SAVE_DB_PRAGMAS = `
PRAGMA journal_mode = DELETE;
PRAGMA synchronous = FULL;
`;

/** STRICT tables need SQLite >= 3.37 (expo-sqlite 57 bundles 3.50.3; Node 26.4 has 3.53.2). */
export const SAVE_DB_DDL_V1 = `
CREATE TABLE IF NOT EXISTS save_slots (
  slot           TEXT    PRIMARY KEY NOT NULL CHECK (slot IN ('current', 'backup')),
  schema_version INTEGER NOT NULL CHECK (schema_version >= 1),
  app_version    TEXT    NOT NULL,
  written_at     INTEGER NOT NULL,
  write_count    INTEGER NOT NULL,
  checksum       TEXT    NOT NULL,
  payload        TEXT    NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS save_quarantine (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  quarantined_at INTEGER NOT NULL,
  slot           TEXT    NOT NULL,
  reason         TEXT    NOT NULL,
  schema_version INTEGER,
  payload        TEXT
) STRICT;
CREATE TABLE IF NOT EXISTS error_log (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  at_ms   INTEGER NOT NULL,
  area    TEXT    NOT NULL,
  message TEXT    NOT NULL,
  details TEXT
) STRICT;
PRAGMA user_version = 1;
`;

export const UPSERT_SLOT_SQL = `
INSERT INTO save_slots (slot, schema_version, app_version, written_at, write_count, checksum, payload)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (slot) DO UPDATE SET
  schema_version = excluded.schema_version,
  app_version = excluded.app_version,
  written_at = excluded.written_at,
  write_count = excluded.write_count,
  checksum = excluded.checksum,
  payload = excluded.payload`;

export const SELECT_SLOT_SQL = `
SELECT schema_version, app_version, written_at, write_count, checksum, payload
FROM save_slots WHERE slot = ?`;

export const QUARANTINE_SLOT_SQL = `
INSERT INTO save_quarantine (quarantined_at, slot, reason, schema_version, payload)
SELECT ?, slot, ?, schema_version, payload FROM save_slots WHERE slot = ?`;

export const TRIM_QUARANTINE_SQL = `
DELETE FROM save_quarantine WHERE id <= (SELECT MAX(id) FROM save_quarantine) - 10`;
