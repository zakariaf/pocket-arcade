// packages/shell/src/services/save/save-codec.test.ts
import { fnv1a32 } from '@e07/shell/services/save/checksum.ts';
import { decodeSlot, encodeSaveDoc } from '@e07/shell/services/save/save-codec.ts';
import { createDefaultSaveDoc } from '@e07/shell/services/save/schema/default-save-doc.ts';

import type { SlotRecord } from '@e07/shell/services/save/save-store.ts';

const META = { appVersion: '1.0.0', writtenAtMs: 1, writeCount: 1 };
const GOOD = encodeSaveDoc(createDefaultSaveDoc('line-siege'), META);

/** A row whose checksum matches its (possibly broken) payload. */
function rowWith(payload: string): SlotRecord {
  return { ...GOOD, payload, checksum: fnv1a32(payload) };
}

describe('decodeSlot', () => {
  it('reads a valid row back as the same document', () => {
    expect(decodeSlot(GOOD, 'line-siege')).toStrictEqual({
      kind: 'ok',
      doc: createDefaultSaveDoc('line-siege'),
      migratedFrom: null,
    });
  });

  it('names what is wrong with a damaged row, and never throws', () => {
    expect(decodeSlot({ ...GOOD, payload: `${GOOD.payload} ` }, 'line-siege')).toStrictEqual({
      kind: 'damaged',
      reason: 'checksum',
    });
    expect(decodeSlot(rowWith('{not json'), 'line-siege')).toStrictEqual({
      kind: 'damaged',
      reason: 'json',
    });
    expect(decodeSlot(rowWith('{}'), 'line-siege')).toMatchObject({ kind: 'damaged' });
    expect(decodeSlot(GOOD, 'flock-tilt')).toStrictEqual({ kind: 'damaged', reason: 'game-id' });
  });

  it('reports a row from a newer app by its version', () => {
    expect(decodeSlot({ ...GOOD, schemaVersion: 99 }, 'line-siege')).toStrictEqual({
      kind: 'newer',
      version: 99,
    });
  });
});
