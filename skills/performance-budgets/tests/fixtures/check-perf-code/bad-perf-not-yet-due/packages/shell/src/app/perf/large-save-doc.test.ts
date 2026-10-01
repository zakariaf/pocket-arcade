// packages/shell/src/app/perf/large-save-doc.test.ts
import { decodeSlot } from '@e07/shell/services/save/save-codec.ts';

import { largestRealisticSaveDoc, largestRealisticSaveRecord } from './large-save-doc.ts';

describe('the largest realistic save', () => {
  it('holds 90 levels, 60 daily results and a 200-move run, and the schema accepts it', () => {
    const doc = largestRealisticSaveDoc('line-siege');
    expect(Object.keys(doc.progress.levels)).toHaveLength(90);
    expect(Object.keys(doc.daily.results)).toHaveLength(60);
    expect(doc.run?.log).toHaveLength(200);
  });

  it('encodes to a slot row the save layer reads back', () => {
    const record = largestRealisticSaveRecord('line-siege');
    expect(record.payload.length).toBeGreaterThan(10_000);
    expect(decodeSlot(record, 'line-siege')).toMatchObject({ kind: 'ok', migratedFrom: null });
  });
});
