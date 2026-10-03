// packages/shell/src/stores/stats-store.test.ts
import { DEFAULT_STATS } from '@e07/shell/services/save/schema/default-save-doc.ts';
import { createStatsStore } from '@e07/shell/stores/stats-store.ts';
import { createTestSave } from '@e07/shell/testing/create-test-save.ts';

import type { SaveService } from '@e07/shell/services/save/save-service.ts';

describe('stats store', () => {
  it('resets statistics in both slots, so a backup restore cannot bring them back', () => {
    const { save, readSlot } = createTestSave();
    save.update((doc) => ({ ...doc, stats: { ...doc.stats, gamesPlayed: 5, wins: 3 } }), {
      refreshBackup: true,
    });
    const stats = createStatsStore(save);
    expect(stats.getState().stats.gamesPlayed).toBe(5);
    stats.getState().dispatch({ type: 'reset-statistics' });
    expect(stats.getState().stats).toStrictEqual(DEFAULT_STATS);
    expect(readSlot('current').stats).toStrictEqual(DEFAULT_STATS);
    expect(readSlot('backup').stats).toStrictEqual(DEFAULT_STATS);
  });

  // N10: the store shows what the save holds. A change the save rejected (an invalid document is
  // never written and never kept in memory) leaves the statistics as they were.
  it('keeps the saved statistics when the save rejects the reset, and resets on the next try', () => {
    const { save, readSlot } = createTestSave();
    save.update((doc) => ({ ...doc, stats: { ...doc.stats, gamesPlayed: 5 } }));
    const rejects = { count: 1 };
    const rejecting: SaveService = {
      ...save,
      update: (recipe, options) => {
        if (rejects.count === 0) return save.update(recipe, options);
        rejects.count -= 1;
        return false;
      },
    };
    const stats = createStatsStore(rejecting);
    stats.getState().dispatch({ type: 'reset-statistics' });
    expect(stats.getState().stats.gamesPlayed).toBe(5);
    stats.getState().dispatch({ type: 'reset-statistics' });
    expect(stats.getState().stats).toStrictEqual(DEFAULT_STATS);
    expect(readSlot('current').stats).toStrictEqual(DEFAULT_STATS);
  });
});
