// packages/shell/src/stores/stats-reducer.test.ts
import { DEFAULT_STATS } from '@e07/shell/services/save/schema/default-save-doc.ts';
import { statsActionRefreshesBackup, statsReducer } from '@e07/shell/stores/stats-reducer.ts';

describe('statsReducer', () => {
  it('resets the statistics to the empty section and refreshes the backup', () => {
    const played = { stats: { ...DEFAULT_STATS, gamesPlayed: 4, wins: 2, playMs: 9000 } };
    const action = { type: 'reset-statistics' } as const;
    expect(statsReducer(played, action)).toStrictEqual({ stats: DEFAULT_STATS });
    expect(statsActionRefreshesBackup(action)).toBe(true);
  });
});
