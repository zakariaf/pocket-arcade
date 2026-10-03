// packages/shell/src/testing/create-test-save.ts
// Store tests build the save the way the app boots (a first launch over the in-memory fake
// store, validated, strict), so "persisted before published" is proven against real validation.
import { createFakeSaveStore } from '@e07/shell/services/save/fake-save-store.ts';
import { planLoad } from '@e07/shell/services/save/load-plan.ts';
import { decodeSlot } from '@e07/shell/services/save/save-codec.ts';
import { createSaveService } from '@e07/shell/services/save/save-service.ts';

import type { ClockPort } from '@e07/shell/services/clock/clock-port.ts';
import type { ErrorLogPort } from '@e07/shell/services/error-log/error-log-port.ts';
import type { FakeSaveStore } from '@e07/shell/services/save/fake-save-store.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { SlotName } from '@e07/shell/services/save/save-store.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

export const TEST_GAME_ID = 'shell-test';

/** 2026-09-26 12:00 (UTC as the local zone): twelve hours to local midnight. */
export const TEST_CLOCK: ClockPort = {
  nowMs: () => 1_790_424_000_000,
  today: () => '2026-09-26',
  msUntilNextLocalDay: () => 43_200_000,
};

/** An invalid document fails the test with the validation error itself. */
const THROWING_ERROR_LOG: ErrorLogPort = {
  record: (_source, error) => {
    throw error;
  },
  entries: () => [],
};

export type TestSave = {
  readonly store: FakeSaveStore;
  readonly save: SaveService;
  /** Decodes what is ON DISK in a slot (not the service's memory copy). */
  readonly readSlot: (slot: SlotName) => SaveDoc;
};

export function createTestSave(clock: ClockPort = TEST_CLOCK): TestSave {
  const store = createFakeSaveStore();
  const plan = planLoad({ current: null, backup: null, gameId: TEST_GAME_ID });
  const deps = { store, clock, errorLog: THROWING_ERROR_LOG, appVersion: '1.0.0', isStrict: true };
  const save = createSaveService(deps, plan, 0);
  save.applyLoadWrites();
  const readSlot = (slot: SlotName): SaveDoc => {
    const record = store.read(slot);
    if (record === null) throw new Error(`slot ${slot} is empty`);
    const decoded = decodeSlot(record, TEST_GAME_ID);
    if (decoded.kind !== 'ok') throw new Error(`slot ${slot} does not decode: ${decoded.kind}`);
    return decoded.doc;
  };
  return { store, save, readSlot };
}
