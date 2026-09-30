// packages/shell/src/services/save/migrations/v1-to-v2.ts
import type { SaveMigration } from '@e07/shell/services/save/migrations/save-migrations.ts';

const asRecord = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/**
 * v2 adds settings.textScale (percent). Pure and frozen: literal values only, no clock, no
 * device, no import of today's defaults (a later default change must not change old upgrades).
 */
export const V1_TO_V2: SaveMigration = {
  from: 1,
  migrate: (doc) => ({ ...doc, settings: { ...asRecord(doc['settings']), textScale: 100 } }),
};
