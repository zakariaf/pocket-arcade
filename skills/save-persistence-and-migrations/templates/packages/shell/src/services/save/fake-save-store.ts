// packages/shell/src/services/save/fake-save-store.ts
import type { SaveStore, SlotName, SlotRecord } from '@e07/shell/services/save/save-store.ts';

/**
 * In-memory SaveStore for component and store tests; `failNextWrite` simulates a crash and
 * `newerStructure` a save.db written by a newer app.
 */
export type FakeSaveStore = SaveStore & {
  readonly slots: Map<SlotName, SlotRecord>;
  readonly quarantined: { slot: SlotName; reason: string }[];
  failNextWrite: boolean;
  newerStructure: number | null;
};

export function createFakeSaveStore(): FakeSaveStore {
  const fake: FakeSaveStore = {
    slots: new Map(),
    quarantined: [],
    failNextWrite: false,
    newerStructure: null,
    read: (slot) => fake.slots.get(slot) ?? null,
    write: (slots) => {
      if (fake.failNextWrite) {
        fake.failNextWrite = false;
        throw new Error('simulated crash before COMMIT');
      }
      if (slots.current !== undefined) fake.slots.set('current', slots.current);
      if (slots.backup !== undefined) fake.slots.set('backup', slots.backup);
    },
    quarantine: (slot, reason) => {
      fake.quarantined.push({ slot, reason });
    },
    checkpoint: () => undefined,
    newerStructureVersion: () => fake.newerStructure,
  };
  return fake;
}
