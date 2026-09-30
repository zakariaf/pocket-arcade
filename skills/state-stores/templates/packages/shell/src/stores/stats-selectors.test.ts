// packages/shell/src/stores/stats-selectors.test.ts
import {
  selectGamesPlayed,
  selectHasPlayed,
  selectStats,
  selectStatsDispatch,
} from '@e07/shell/stores/stats-selectors.ts';
import { createStatsStore } from '@e07/shell/stores/stats-store.ts';
import { createTestSave } from '@e07/shell/testing/create-test-save.ts';

describe('stats selectors', () => {
  it('sees a new player as not played yet (the S10 empty state)', () => {
    const state = createStatsStore(createTestSave().save).getState();

    expect([selectGamesPlayed(state), selectHasPlayed(state)]).toStrictEqual([0, false]);
    expect(selectStats(state)).toBe(state.stats);
    expect(selectStatsDispatch(state)).toBe(state.dispatch);
  });

  it('sees a player with finished games', () => {
    const { save } = createTestSave();
    save.update((doc) => ({ ...doc, stats: { ...doc.stats, gamesPlayed: 4 } }));
    const state = createStatsStore(save).getState();

    expect([selectGamesPlayed(state), selectHasPlayed(state)]).toStrictEqual([4, true]);
  });
});
