// packages/shell/src/services/save/save-codec.test.ts
import fc from 'fast-check';

import { fnv1a32 } from '@e07/shell/services/save/checksum.ts';
import { decodeSlot, encodeSaveDoc } from '@e07/shell/services/save/save-codec.ts';
import { createDefaultSaveDoc } from '@e07/shell/services/save/schema/default-save-doc.ts';

import type { SlotRecord } from '@e07/shell/services/save/save-store.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

const META = { appVersion: '1.0.0', writtenAtMs: 1, writeCount: 1 };
const GOOD = encodeSaveDoc(createDefaultSaveDoc('line-siege'), META);

/** A row whose checksum matches its (possibly broken) payload. */
function rowWith(payload: string): SlotRecord {
  return { ...GOOD, payload, checksum: fnv1a32(payload) };
}

const percent = fc.integer({ min: 0, max: 100 });
const count = fc.nat();
const docArb = fc
  .record({ soundVolume: percent, musicVolume: percent, colorBlind: fc.boolean() })
  .chain((settings) =>
    fc
      .record({ gamesPlayed: count, wins: count, endlessBest: count })
      .map(({ gamesPlayed, wins, endlessBest }): SaveDoc => {
        const doc = createDefaultSaveDoc('line-siege');
        return {
          ...doc,
          settings: { ...doc.settings, ...settings },
          progress: { ...doc.progress, endlessBest },
          stats: { ...doc.stats, gamesPlayed, wins },
        };
      }),
  );

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

  it('reports a document with an unknown key as damaged by the schema', () => {
    const doc = { ...createDefaultSaveDoc('line-siege'), coins: 0 };

    expect(decodeSlot(rowWith(JSON.stringify(doc)), 'line-siege')).toStrictEqual({
      kind: 'damaged',
      reason: expect.stringMatching(/^schema /) as unknown,
    });
  });

  it('decodes every encoded valid document back to itself', () => {
    fc.assert(
      fc.property(docArb, (doc) => {
        expect(decodeSlot(encodeSaveDoc(doc, META), 'line-siege')).toStrictEqual({
          kind: 'ok',
          doc,
          migratedFrom: null,
        });
      }),
    );
  });
});
