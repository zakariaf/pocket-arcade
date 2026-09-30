// packages/shell/src/stores/stats-store.test.ts
import { DEFAULT_STATS } from '@e07/shell/services/save/schema/default-save-doc.ts';
import { createStatsStore } from '@e07/shell/stores/stats-store.ts';
import { createTestSave } from '@e07/shell/testing/create-test-save.ts';

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
});
