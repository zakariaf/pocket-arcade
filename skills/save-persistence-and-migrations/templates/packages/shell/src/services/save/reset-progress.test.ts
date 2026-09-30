// packages/shell/src/services/save/reset-progress.test.ts
import { fnv1a32 } from '@e07/shell/services/save/checksum.ts';
import { resetAllProgress, resetStatistics } from '@e07/shell/services/save/reset-progress.ts';
import { decodeSlot } from '@e07/shell/services/save/save-codec.ts';
import { DEFAULT_STATS } from '@e07/shell/services/save/schema/default-save-doc.ts';

import saveV1Full from './fixtures/save-v1.full.json';

import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

function fullFixture(): SaveDoc {
  const payload = JSON.stringify(saveV1Full);
  const record = {
    schemaVersion: 1,
    appVersion: 't',
    writtenAtMs: 0,
    writeCount: 1,
    checksum: fnv1a32(payload),
    payload,
  };
  const decoded = decodeSlot(record, 'line-siege');
  if (decoded.kind !== 'ok') throw new Error('fixture must decode');
  return decoded.doc;
}

describe('resetAllProgress', () => {
  it('keeps premium, settings, first-run flags and ads; clears everything else', () => {
    const doc = fullFixture();
    const reset = resetAllProgress(doc);
    expect(reset.premium).toStrictEqual(doc.premium);
    expect(reset.settings).toStrictEqual(doc.settings);
    expect(reset.firstRun).toStrictEqual(doc.firstRun);
    expect(reset.ads).toStrictEqual(doc.ads);
    expect(reset.progress).toStrictEqual({ levels: {}, endlessBest: 0 });
    expect(reset.run).toBeNull();
    expect(reset.daily.results).toStrictEqual({});
    expect(reset.stats).toStrictEqual(DEFAULT_STATS);
  });
});

describe('resetStatistics', () => {
  it('clears the stats section only', () => {
    const doc = fullFixture();
    const reset = resetStatistics(doc);
    expect(reset.stats).toStrictEqual(DEFAULT_STATS);
    expect(reset.progress).toStrictEqual(doc.progress);
    expect(reset.daily).toStrictEqual(doc.daily);
  });
});
