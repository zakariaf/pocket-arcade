// packages/shell/src/services/save/save-codec.ts
import * as v from 'valibot';

import { fnv1a32 } from '@e07/shell/services/save/checksum.ts';
import { migrateToLatest } from '@e07/shell/services/save/migrations/save-migrations.ts';
import {
  LATEST_SAVE_SCHEMA,
  LATEST_SAVE_VERSION,
} from '@e07/shell/services/save/schema/save-doc.ts';

import type { SlotRecord } from '@e07/shell/services/save/save-store.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

export type DecodeResult =
  | { readonly kind: 'ok'; readonly doc: SaveDoc; readonly migratedFrom: number | null }
  | { readonly kind: 'newer'; readonly version: number }
  | { readonly kind: 'damaged'; readonly reason: string };

export type EncodeMeta = {
  readonly appVersion: string;
  readonly writtenAtMs: number;
  readonly writeCount: number;
};

/** Validates the latest schema; returns issues as one short string for the error log. */
export function validateSaveDoc(
  doc: unknown,
): { readonly doc: SaveDoc } | { readonly error: string } {
  const result = v.safeParse(LATEST_SAVE_SCHEMA, doc);
  if (result.success) return { doc: result.output };
  const first = result.issues[0];
  return { error: `${v.getDotPath(first) ?? '(root)'}: ${first.message}` };
}

export function encodeSaveDoc(doc: SaveDoc, meta: EncodeMeta): SlotRecord {
  const payload = JSON.stringify(doc);
  return { schemaVersion: doc.schemaVersion, checksum: fnv1a32(payload), payload, ...meta };
}

function parseJson(payload: string): unknown {
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return undefined;
  }
}

/** Row -> latest document. Never throws; never writes. */
export function decodeSlot(record: SlotRecord, gameId: string): DecodeResult {
  if (record.schemaVersion > LATEST_SAVE_VERSION)
    return { kind: 'newer', version: record.schemaVersion };
  if (fnv1a32(record.payload) !== record.checksum) return { kind: 'damaged', reason: 'checksum' };
  const parsed = parseJson(record.payload);
  if (parsed === undefined) return { kind: 'damaged', reason: 'json' };
  const isOld = record.schemaVersion < LATEST_SAVE_VERSION;
  const migrated = isOld ? migrateToLatest(parsed, record.schemaVersion) : parsed;
  const checked = validateSaveDoc(migrated);
  if ('error' in checked) return { kind: 'damaged', reason: `schema ${checked.error}` };
  if (checked.doc.gameId !== gameId) return { kind: 'damaged', reason: 'game-id' };
  return { kind: 'ok', doc: checked.doc, migratedFrom: isOld ? record.schemaVersion : null };
}
