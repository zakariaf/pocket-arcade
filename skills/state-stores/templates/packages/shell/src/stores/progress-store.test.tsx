// packages/shell/src/stores/progress-store.test.tsx
import { renderHook } from '@testing-library/react-native';
import { useShallow } from 'zustand/shallow';

import { StoresProvider } from '@e07/shell/app/stores-context.tsx';
import { createShellStores } from '@e07/shell/stores/create-shell-stores.ts';
import { selectFreeHintsLeft, selectPackStars } from '@e07/shell/stores/progress-selectors.ts';
import { createProgressStore, useProgressStore } from '@e07/shell/stores/progress-store.ts';
import { createTestSave, TEST_CLOCK } from '@e07/shell/testing/create-test-save.ts';

import type { ReactNode } from 'react';

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
