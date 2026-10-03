// packages/shell/src/services/save/fake-save-store.test.ts
import { createFakeSaveStore } from '@e07/shell/services/save/fake-save-store.ts';

import type { SlotRecord } from '@e07/shell/services/save/save-store.ts';

const RECORD: SlotRecord = {
  schemaVersion: 1,
  appVersion: '1.0.0',
  writtenAtMs: 1,
  writeCount: 1,
  checksum: 'x',
  payload: '{}',
};

describe('createFakeSaveStore', () => {
  it('keeps what was written, slot by slot', () => {
    const store = createFakeSaveStore();
    store.write({ current: RECORD });
    expect([store.read('current'), store.read('backup')]).toStrictEqual([RECORD, null]);
    store.write({ backup: RECORD });
    expect(store.read('backup')).toBe(RECORD);
  });

  it('fails exactly the next write when asked to simulate a crash', () => {
    const store = createFakeSaveStore();
    store.failNextWrite = true;
    expect(() => {
      store.write({ current: RECORD });
    }).toThrow('simulated crash before COMMIT');
    expect(store.read('current')).toBeNull();
    store.write({ current: RECORD });
    expect(store.read('current')).toBe(RECORD);
  });

  it('records quarantines, ignores checkpoints and reports a newer structure when set', () => {
    const store = createFakeSaveStore();
    store.quarantine('current', 'checksum', 5);
    store.checkpoint();
    expect(store.quarantined).toStrictEqual([{ slot: 'current', reason: 'checksum' }]);
    expect(store.newerStructureVersion()).toBeNull();
    store.newerStructure = 3;
    expect(store.newerStructureVersion()).toBe(3);
  });
});
