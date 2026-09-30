// packages/shell/src/services/save/fixtures/save-fixtures.test.ts
import { fnv1a32 } from '@e07/shell/services/save/checksum.ts';
import { decodeSlot, encodeSaveDoc } from '@e07/shell/services/save/save-codec.ts';

import { FIXTURE_CHECKSUMS } from './fixture-checksums.ts';
import saveV1Full from './save-v1.full.json';
import saveV1Minimal from './save-v1.minimal.json';

import type { SlotRecord } from '@e07/shell/services/save/save-store.ts';

/** Every save version ever shipped, as the JSON an old app wrote. Append only. */
const FIXTURES = [
  { name: 'save-v1.minimal', version: 1, json: saveV1Minimal },
  { name: 'save-v1.full', version: 1, json: saveV1Full },
] as const;

function asStoredRow(json: unknown, version: number): SlotRecord {
  const payload = JSON.stringify(json);
  return {
    schemaVersion: version,
    appVersion: 'fixture',
    writtenAtMs: 0,
    writeCount: 1,
    checksum: fnv1a32(payload),
    payload,
  };
}

describe('save fixtures', () => {
  it.each(FIXTURES)('keeps $name frozen', ({ name, json }) => {
    expect(fnv1a32(JSON.stringify(json))).toBe(FIXTURE_CHECKSUMS[name]);
  });

  it.each(FIXTURES)('upgrades $name to a valid latest document', ({ json, version }) => {
    const decoded = decodeSlot(asStoredRow(json, version), 'line-siege');
    expect(decoded.kind).toBe('ok');
  });

  it.each(FIXTURES)('survives an encode/decode round trip for $name', ({ json, version }) => {
    const first = decodeSlot(asStoredRow(json, version), 'line-siege');
    if (first.kind !== 'ok') throw new Error('fixture must decode');
    const again = decodeSlot(
      encodeSaveDoc(first.doc, { appVersion: 't', writtenAtMs: 1, writeCount: 2 }),
      'line-siege',
    );
    expect(again).toStrictEqual({ kind: 'ok', doc: first.doc, migratedFrom: null });
  });
});
