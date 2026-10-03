// packages/shell/src/stores/progress-store.test.tsx
import { renderHook } from '@testing-library/react-native';
import { useShallow } from 'zustand/shallow';

import { StoresProvider } from '@e07/shell/app/stores-context.tsx';
import { createFakeErrorLog } from '@e07/shell/services/error-log/fake-error-log.ts';
import { createFakeSaveStore } from '@e07/shell/services/save/fake-save-store.ts';
import { planLoad } from '@e07/shell/services/save/load-plan.ts';
import { decodeSlot } from '@e07/shell/services/save/save-codec.ts';
import { createSaveService } from '@e07/shell/services/save/save-service.ts';
import { createShellStores } from '@e07/shell/stores/create-shell-stores.ts';
import { selectFreeHintsLeft, selectPackStars } from '@e07/shell/stores/progress-selectors.ts';
import { createProgressStore, useProgressStore } from '@e07/shell/stores/progress-store.ts';
import { createTestSave, TEST_CLOCK, TEST_GAME_ID } from '@e07/shell/testing/create-test-save.ts';

import type { ReactNode } from 'react';

/** A store build's save: an invalid document is logged and not written (never thrown). */
function lenientSave() {
  const store = createFakeSaveStore();
  const plan = planLoad({ current: null, backup: null, gameId: TEST_GAME_ID });
  const deps = { store, clock: TEST_CLOCK, errorLog: createFakeErrorLog(), appVersion: '1.0.0' };
  const save = createSaveService({ ...deps, isStrict: false }, plan, 0);
  save.applyLoadWrites();
  const onDisk = () => {
    const record = store.read('current');
    const decoded = record === null ? null : decodeSlot(record, TEST_GAME_ID);
    if (decoded?.kind !== 'ok') throw new Error('current slot does not decode');
    return decoded.doc;
  };
  return { save, onDisk };
}

describe('progress store', () => {
  it('persists a hint before publishing it', () => {
    const { save, readSlot } = createTestSave();
    const progress = createProgressStore(save);
    const today = TEST_CLOCK.today();
    const seen: number[] = [];
    progress.subscribe(() => {
      seen.push(readSlot('current').hints.freeUsed);
    });
    progress.getState().dispatch({ type: 'use-free-hint', today, freePerDay: 1 });
    expect(seen).toStrictEqual([1]);
    expect(selectFreeHintsLeft(progress.getState(), today, 1)).toBe(0);
  });

  it('writes nothing for an action that changes nothing', () => {
    const { save, store } = createTestSave();
    const progress = createProgressStore(save);
    const today = TEST_CLOCK.today();
    progress.getState().dispatch({ type: 'use-free-hint', today, freePerDay: 1 });
    const written = store.read('current')?.writeCount;
    progress.getState().dispatch({ type: 'use-free-hint', today, freePerDay: 1 });
    expect(store.read('current')?.writeCount).toBe(written);
  });

  // N10: a document the save rejected never reaches the store. Were it published, every later
  // change would be built on it and rejected too, and no progress would reach the disk again.
  it('keeps the last valid progress when the save rejects a change, and saves the next one', () => {
    const { save, onDisk } = lenientSave();
    const progress = createProgressStore(save);
    const today = TEST_CLOCK.today();
    progress.getState().dispatch({ type: 'record-endless-score', score: 1.5 });
    expect(progress.getState().progress.endlessBest).toBe(0);
    progress.getState().dispatch({ type: 'use-free-hint', today, freePerDay: 1 });
    expect(onDisk().hints.freeUsed).toBe(1);
    expect(selectFreeHintsLeft(progress.getState(), today, 1)).toBe(0);
  });

  it('reads an object selector through useShallow without re-render loops', async () => {
    const { save } = createTestSave();
    const stores = createShellStores(save);
    const wrapper = ({ children }: { readonly children: ReactNode }): ReactNode => (
      <StoresProvider stores={stores}>{children}</StoresProvider>
    );
    const { result } = await renderHook(
      () => useProgressStore(useShallow((state) => selectPackStars(state, [1, 2, 3]))),
      { wrapper },
    );
    expect(result.current).toStrictEqual({ earned: 0, total: 9 });
  });
});
