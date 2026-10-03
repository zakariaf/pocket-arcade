// packages/shell/src/stores/progress-selectors.test.ts
import { createProgressStore } from '@e07/shell/stores/progress-store.ts';
import { createTestSave, TEST_CLOCK } from '@e07/shell/testing/create-test-save.ts';

import { selectCanShowUpsell, selectFreeHintsLeft, selectNextLevel } from './progress-selectors.ts';

function progressStore() {
  return createProgressStore(createTestSave().save);
}

describe('progress selectors', () => {
  it('gives no free hint in a game whose config says 0 (hints.freePerDay)', () => {
    const progress = progressStore();
    expect(selectFreeHintsLeft(progress.getState(), TEST_CLOCK.today(), 0)).toBe(0);
  });

  it('gives one free hint a day when the config says 1, and a fresh one the next day', () => {
    const progress = progressStore();
    const today = TEST_CLOCK.today();
    expect(selectFreeHintsLeft(progress.getState(), today, 1)).toBe(1);
    progress.getState().dispatch({ type: 'use-free-hint', today, freePerDay: 1 });
    expect(selectFreeHintsLeft(progress.getState(), today, 1)).toBe(0);
    expect(selectFreeHintsLeft(progress.getState(), '2026-09-27', 1)).toBe(1);
  });

  it('picks the first level without a result and shows the upsell once a day', () => {
    const progress = progressStore();
    const today = TEST_CLOCK.today();
    expect(selectNextLevel(progress.getState(), 90)).toBe(1);
    expect(selectCanShowUpsell(progress.getState(), today)).toBe(true);
    progress.getState().dispatch({ type: 'record-upsell-shown', today });
    expect(selectCanShowUpsell(progress.getState(), today)).toBe(false);
  });
});
