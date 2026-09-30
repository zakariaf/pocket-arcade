// packages/shell/src/services/save/sqlite-save-store.ts
import {
  DB_STRUCTURE_VERSION,
  QUARANTINE_SLOT_SQL,
  SAVE_DB_DDL_V1,
  SAVE_DB_PRAGMAS,
  SELECT_SLOT_SQL,
  TRIM_QUARANTINE_SQL,
  UPSERT_SLOT_SQL,
} from '@e07/shell/services/save/save-db-schema.ts';

import type { SlotName, SlotRecord, SaveStore } from '@e07/shell/services/save/save-store.ts';
import type { SqlDriver, SqlRow } from '@e07/shell/services/save/sql-driver.ts';

function toSlotRecord(row: SqlRow | null): SlotRecord | null {
  if (row === null) return null;
  const { schema_version, app_version, written_at, write_count, checksum, payload } = row;
  if (
    typeof schema_version !== 'number' ||
    typeof app_version !== 'string' ||
    typeof written_at !== 'number' ||
    typeof write_count !== 'number' ||
    typeof checksum !== 'string' ||
    typeof payload !== 'string'
  ) {
    return null;
  }
  return {
    schemaVersion: schema_version,
    appVersion: app_version,
    writtenAtMs: written_at,
    writeCount: write_count,
    checksum,
    payload,
  };
}

function upsert(driver: SqlDriver, slot: SlotName, record: SlotRecord): void {
  driver.run(UPSERT_SLOT_SQL, [
    slot,
    record.schemaVersion,
    record.appVersion,
    record.writtenAtMs,
    record.writeCount,
    record.checksum,
    record.payload,
  ]);
}

/**
 * Reads the table version first. A save.db made by a newer app (after installing an older
 * build) is left untouched: no pragma, no DDL, no write. Returns that version, or null once
 * the tables are ready (created on a fresh file).
 */
function prepareDatabase(driver: SqlDriver): number | null {
  const version = driver.get('PRAGMA user_version', [])?.['user_version'];
  if (typeof version === 'number' && version > DB_STRUCTURE_VERSION) return version;
  driver.exec(SAVE_DB_PRAGMAS);
  if (version === 0) driver.exec(SAVE_DB_DDL_V1);
  return null;
}

/** Tables of unknown shape: read nothing, write nothing, and let the load plan go read-only. */
function newerStructureStore(version: number): SaveStore {
  return {
    read: () => null,
    write: () => undefined,
    quarantine: () => undefined,
    checkpoint: () => undefined,
    newerStructureVersion: () => version,
  };
}

export function createSqliteSaveStore(driver: SqlDriver): SaveStore {
  const newer = prepareDatabase(driver);
  if (newer !== null) return newerStructureStore(newer);
  return {
    read: (slot) => toSlotRecord(driver.get(SELECT_SLOT_SQL, [slot])),
    write: (slots) => {
      driver.transaction(() => {
        if (slots.current !== undefined) upsert(driver, 'current', slots.current);
        if (slots.backup !== undefined) upsert(driver, 'backup', slots.backup);
      });
    },
    quarantine: (slot, reason, atMs) => {
      driver.transaction(() => {
        driver.run(QUARANTINE_SLOT_SQL, [atMs, reason, slot]);
        driver.run(TRIM_QUARANTINE_SQL, []);
      });
    },
    checkpoint: () => {
      driver.get('PRAGMA wal_checkpoint(TRUNCATE)', []);
    },
    newerStructureVersion: () => null,
  };
}
