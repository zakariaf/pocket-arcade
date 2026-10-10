// packages/shell/src/screens/stats/use-stats-summary.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { createFakeClock } from '@e07/shell/services/clock/fake-clock.ts';
import { createTestSave } from '@e07/shell/testing/create-test-save.ts';
import { createShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';

import { useStatsSummary } from './use-stats-summary.ts';

jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));

const GAME = { levelCount: 90, hasEndless: true, counterIds: ['monsters-defeated'] };

describe('useStatsSummary', () => {
  it("summarises the saved statistics for today and follows the stats store's changes", async () => {
    const clock = createFakeClock({ nowMs: 1_790_424_000_000, today: '2026-09-26' });
    const { save } = createTestSave(clock);
    save.update((doc) => ({
      ...doc,
      stats: {
        ...doc.stats,
        gamesPlayed: 2,
        wins: 1,
        losses: 1,
        days: { '2026-09-26': { games: 2, playMs: 120_000 } },
        counters: { 'monsters-defeated': 7 },
      },
    }));
    const { wrapper, stores } = createShellWrapper({ services: { clock, save } });
    const { result } = await renderHook(() => useStatsSummary(GAME), { wrapper });
    expect(result.current).toMatchObject({ isEmpty: false, levels: { starsTotal: 270 } });
    expect(result.current.week.days.at(-1)).toStrictEqual({
      date: '2026-09-26',
      weekday: 6,
      games: 2,
    });
    expect(result.current.counters).toStrictEqual([{ id: 'monsters-defeated', value: 7 }]);

    await act(() => {
      stores.stats.getState().dispatch({ type: 'reset-statistics' });
    });
    expect(result.current.isEmpty).toBe(true);
  });
});
