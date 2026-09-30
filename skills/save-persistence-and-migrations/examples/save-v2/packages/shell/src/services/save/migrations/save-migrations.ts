// packages/shell/src/services/save/migrations/save-migrations.ts
import { V1_TO_V2 } from '@e07/shell/services/save/migrations/v1-to-v2.ts';
import { LATEST_SAVE_VERSION } from '@e07/shell/services/save/schema/save-doc.ts';

/** A pure step vN -> vN+1 over plain JSON. Never reads the clock, the device or the Shell. */
export type SaveMigration = {
  readonly from: number;
  readonly migrate: (doc: Readonly<Record<string, unknown>>) => Record<string, unknown>;
};

/** Ordered, append-only. Index i migrates version i+1 -> i+2. */
export const SAVE_MIGRATIONS: readonly SaveMigration[] = [V1_TO_V2];

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Runs every step from `fromVersion` up to `latest` over plain JSON. Returns null when a step
 * is missing, the document is not an object, or a step throws: the load then treats the slot as
 * damaged (backup, quarantine), never as a crash at boot.
 */
export function runMigrations(
  steps: readonly SaveMigration[],
  doc: unknown,
  versions: { readonly from: number; readonly latest: number },
): unknown {
  let current: unknown = doc;
  for (let version = versions.from; version < versions.latest; version += 1) {
    const step = steps.find((migration) => migration.from === version);
    if (step === undefined || !isRecord(current)) return null;
    try {
      current = { ...step.migrate(current), schemaVersion: version + 1 };
    } catch {
      return null;
    }
  }
  return current;
}

/** The app's chain: SAVE_MIGRATIONS from `fromVersion` to LATEST_SAVE_VERSION. */
export function migrateToLatest(doc: unknown, fromVersion: number): unknown {
  return runMigrations(SAVE_MIGRATIONS, doc, { from: fromVersion, latest: LATEST_SAVE_VERSION });
}
