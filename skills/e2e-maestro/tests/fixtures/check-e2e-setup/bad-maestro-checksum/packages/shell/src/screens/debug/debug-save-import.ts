// packages/shell/src/screens/debug/debug-save-import.ts
// Pure: S15's "Import save from text" reads the text "Export save as text" wrote (the save
// document as JSON) through the save codec itself: the payload gets its checksum, then
// decodeSlot migrates an older schema, validates the latest one with valibot and checks the game
// id, exactly as a save row is read at boot. Every failure is one readable sentence for S15.
import { fnv1a32 } from '@e07/shell/services/save/checksum.ts';
import { decodeSlot } from '@e07/shell/services/save/save-codec.ts';
import { LATEST_SAVE_VERSION } from '@e07/shell/services/save/schema/save-doc.ts';

import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

export type SaveTextDecode =
  | { readonly kind: 'ok'; readonly doc: SaveDoc }
  | { readonly kind: 'error'; readonly message: string };

const NOT_A_SAVE =
  'This is not a saved game: paste the whole text that "Export save as text" wrote.';

/** The schemaVersion of a JSON object, or null when the text is not one. */
function schemaVersionOf(text: string): number | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || !('schemaVersion' in value)) return null;
  const version: unknown = value.schemaVersion;
  return typeof version === 'number' && Number.isInteger(version) && version >= 1 ? version : null;
}

function damagedMessage(reason: string, gameId: string): string {
  if (reason === 'game-id') return `This save belongs to another game, not ${gameId}.`;
  if (reason.startsWith('schema ')) {
    return `This save does not match the save format: ${reason.slice('schema '.length)}.`;
  }
  return NOT_A_SAVE;
}

/** The save document in `text`, migrated and validated for this game, or why it cannot be read. */
export function decodeSaveText(text: string, gameId: string): SaveTextDecode {
  const payload = text.trim();
  const schemaVersion = schemaVersionOf(payload);
  if (schemaVersion === null) return { kind: 'error', message: NOT_A_SAVE };
  const record = {
    schemaVersion,
    checksum: fnv1a32(payload),
    payload,
    appVersion: 'debug-import',
    writtenAtMs: 0,
    writeCount: 0,
  };
  const decoded = decodeSlot(record, gameId);
  if (decoded.kind === 'ok') return { kind: 'ok', doc: decoded.doc };
  if (decoded.kind === 'newer') {
    return {
      kind: 'error',
      message: `This save is from a newer app (format ${String(decoded.version)}); this build reads format ${String(LATEST_SAVE_VERSION)}.`,
    };
  }
  return { kind: 'error', message: damagedMessage(decoded.reason, gameId) };
}
