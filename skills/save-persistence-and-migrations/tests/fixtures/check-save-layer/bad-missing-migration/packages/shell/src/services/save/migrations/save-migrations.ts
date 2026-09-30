// packages/shell/src/services/save/migrations/save-migrations.ts
import { LATEST_SAVE_VERSION } from '@e07/shell/services/save/schema/save-doc.ts';

/** A pure step vN -> vN+1 over plain JSON. Never reads the clock, the device or the Shell. */
export type SaveMigration = {
  readonly from: number;
  readonly migrate: (doc: Readonly<Record<string, unknown>>) => Record<string, unknown>;
};

/**
 * Ordered, append-only. Index i migrates version i+1 -> i+2.
 * v1 is the first shipped version, so the list is empty until v2 exists.
 */
export const SAVE_MIGRATIONS: readonly SaveMigration[] = [];

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Runs every step from `fromVersion` to LATEST; null if a step is missing or throws. */
export function migrateToLatest(doc: unknown, fromVersion: number): unknown {
  let current: unknown = doc;
  for (let version = fromVersion; version < LATEST_SAVE_VERSION; version += 1) {
    const step = SAVE_MIGRATIONS.find((migration) => migration.from === version);
    if (step === undefined || !isRecord(current)) return null;
    current = { ...step.migrate(current), schemaVersion: version + 1 };
  }
  return current;
}
