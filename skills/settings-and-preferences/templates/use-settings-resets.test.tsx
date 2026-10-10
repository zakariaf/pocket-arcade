// packages/shell/src/stores/use-settings-resets.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { recordLevelResult } from '@e07/shell/stores/progress-reducer.ts';
import { updateAndPublish } from '@e07/shell/stores/update-and-publish.ts';
import { createTestSave } from '@e07/shell/testing/create-test-save.ts';
import { createShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';

import { useSettingsResets } from './use-settings-resets.ts';

import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

const WIN = { level: 1, stars: 3, score: 500, moves: 7, date: '2026-09-26' } as const;

function playedOnce(doc: SaveDoc): SaveDoc {
  return {
    ...doc,
    progress: recordLevelResult(doc.progress, WIN),
    stats: { ...doc.stats, gamesPlayed: doc.stats.gamesPlayed + 1, wins: doc.stats.wins + 1 },
  };
}

/** The hook bound to the app's save and stores, after one won level with the dark theme on. */
async function resetsAfterOneWin() {
  const test = createTestSave();
  const shell = createShellWrapper({ settings: { theme: 'dark' }, services: { save: test.save } });
  const { result } = await renderHook(() => useSettingsResets(), { wrapper: shell.wrapper });
  await act(() => {
    updateAndPublish(test.save, shell.stores, { recipe: playedOnce, refreshBackup: true });
  });
  return { result, stores: shell.stores, readSlot: test.readSlot };
}

// Spec S11: "Reset statistics" and "Reset all progress" (each confirmed in S14) keep the
// language, the settings and Premium; every screen shows the reset at once.
describe('useSettingsResets', () => {
  it("resets the app's statistics on disk and in its stores, keeping progress (spec S11)", async () => {
    const { result, stores, readSlot } = await resetsAfterOneWin();
    await act(() => {
      result.current.onConfirmResetStats();
    });
    expect([stores.stats.getState().stats.wins, readSlot('current').stats.wins]).toStrictEqual([
      0, 0,
    ]);
    expect(stores.progress.getState().progress.levels['1']?.stars).toBe(3);
  });

  it('resets all progress on disk and in its stores, keeping the settings (spec S11)', async () => {
    const { result, stores, readSlot } = await resetsAfterOneWin();
    await act(() => {
      result.current.onConfirmResetProgress();
    });
    expect(stores.progress.getState().progress.levels['1']).toBeUndefined();
    expect(readSlot('current').progress.levels['1']).toBeUndefined();
    expect(stores.stats.getState().stats.gamesPlayed).toBe(0);
    expect(stores.settings.getState().settings.theme).toBe('dark');
  });
});
