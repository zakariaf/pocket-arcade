// packages/shell/src/screens/daily/use-daily-model.test.tsx
import { act, renderHook } from '@testing-library/react-native';

import { stripIsolates } from '@e07/shell/i18n/bidi.ts';
import { createFakeClock } from '@e07/shell/services/clock/fake-clock.ts';
import { applyRunEnd } from '@e07/shell/stores/run-end.ts';
import { updateAndPublish } from '@e07/shell/stores/update-and-publish.ts';
import { createHostWrapper } from '@e07/shell/testing/create-host-wrapper.tsx';
import { createTestSave } from '@e07/shell/testing/create-test-save.ts';
import { createShellWrapper } from '@e07/shell/testing/render-with-shell.tsx';

import { useDailyModel } from './use-daily-model.ts';

import type { DateKey } from '@e07/game-kit/dates/date-key.ts';
import type { FakeClock } from '@e07/shell/services/clock/fake-clock.ts';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { RenderWithShellOptions } from '@e07/shell/testing/render-with-shell.tsx';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useIsFocused: () => true,
}));

/** Saturday 2026-09-26, noon: the day the screenshots and flows use. */
const CLOCK = createFakeClock({ nowMs: 1_790_424_000_000, today: '2026-09-26' });

async function dailyModel() {
  const { wrapper } = createShellWrapper({ services: { clock: CLOCK } });
  const { result } = await renderHook(() => useDailyModel(), { wrapper });
  return result.current;
}

describe('useDailyModel', () => {
  it('names today from the Shell clock and the catalogs, with no result before the first game', async () => {
    const model = await dailyModel();

    expect([model.monthText, model.dayText, model.todayResult]).toStrictEqual(['Sep', '26', null]);
    // Free text (weekday and month names) is isolated with FSI/PDI inside the sentence.
    expect(stripIsolates(model.dateText)).toBe('Saturday, 26 Sep');
    expect(model.week).toHaveLength(7);
    expect(model.week.at(-1)).toMatchObject({
      weekdayName: 'Saturday',
      state: 'today',
      isToday: true,
    });
  });

  it("opens today's challenge for Play and Replay, and leaves through Back", async () => {
    const model = await dailyModel();

    model.onPlay();
    model.onReplay();
    model.onBack();

    const today = { start: 'new', ref: { kind: 'daily', date: '2026-09-26' } };
    expect(mockNavigate.mock.calls).toStrictEqual([
      ['Game', today],
      ['Game', today],
    ]);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  describe('over the summary buildDailySummary gives (spec S9)', () => {
    /** Saturday 2026-09-26 at noon, by default 12 h before local midnight. */
    function noonClock(msUntilNextLocalDay?: number): FakeClock {
      return createFakeClock({
        nowMs: 1_790_424_000_000,
        today: '2026-09-26',
        ...(msUntilNextLocalDay === undefined ? {} : { msUntilNextLocalDay }),
      });
    }

    /** S9's model hook over a host wrapper sharing `clock` and a test save. */
    async function dailyHook(clock: FakeClock, options: RenderWithShellOptions = {}) {
      const { save } = createTestSave(clock);
      const shell = createHostWrapper({ ...options, services: { clock, save } });
      const view = await renderHook(() => useDailyModel(), { wrapper: shell.wrapper });
      /** A finished daily run of `date`, written as the game host writes it. */
      const finishDaily = async (date: DateKey, score: number): Promise<void> => {
        const end = {
          mode: 'daily',
          date,
          isWon: true,
          score,
          moves: 9,
          playMs: 60_000,
          counters: {},
        } as const;
        await act(() => {
          updateAndPublish(save, shell.stores, {
            recipe: (doc) => applyRunEnd(doc, end, clock.today()),
            refreshBackup: true,
          });
        });
      };
      return { ...view, shell, save, finishDaily };
    }

    function withStreak(save: SaveService, lastDate: DateKey, length: number): void {
      save.update((doc) => ({
        ...doc,
        daily: { ...doc.daily, streak: { lastDate, length }, bestStreak: 12 },
      }));
    }

    it("shows Play until today's first game, then today's score", async () => {
      const { result, finishDaily } = await dailyHook(noonClock());
      expect(result.current.todayResult).toBeNull();

      await finishDaily('2026-09-26', 1840);

      expect(result.current.todayResult?.score).toBe(1840);
    });

    it('counts only the first completion of the day (spec S9: replays change nothing)', async () => {
      const { result, finishDaily } = await dailyHook(noonClock());
      await finishDaily('2026-09-26', 1840);
      const first = result.current;

      await finishDaily('2026-09-26', 9999);

      expect(result.current.todayResult?.score).toBe(1840);
      expect([result.current.currentStreak, result.current.bestStreak]).toStrictEqual([
        first.currentStreak,
        first.bestStreak,
      ]);
      expect(result.current.week).toStrictEqual(first.week);
    });

    it('keeps a streak played yesterday, and adds today to it (spec S9)', async () => {
      const clock = noonClock();
      const { save } = createTestSave(clock);
      withStreak(save, '2026-09-25', 5);
      const shell = createHostWrapper({ services: { clock, save } });
      const { result } = await renderHook(() => useDailyModel(), { wrapper: shell.wrapper });
      expect(result.current.currentStreak).toBe(5);

      const end = {
        mode: 'daily',
        date: '2026-09-26',
        isWon: false,
        score: 300,
        moves: 4,
        playMs: 20_000,
        counters: {},
      } as const;
      await act(() => {
        updateAndPublish(save, shell.stores, {
          recipe: (doc) => applyRunEnd(doc, end, clock.today()),
          refreshBackup: true,
        });
      });

      expect(result.current.currentStreak).toBe(6);
    });

    it('drops a streak last played two days ago, keeping the best streak', async () => {
      const clock = noonClock();
      const { save } = createTestSave(clock);
      withStreak(save, '2026-09-24', 5);
      const shell = createHostWrapper({ services: { clock, save } });
      const { result } = await renderHook(() => useDailyModel(), { wrapper: shell.wrapper });

      expect([result.current.currentStreak, result.current.bestStreak]).toStrictEqual([0, 12]);
    });

    it('keeps a done day done and counted once when the clock goes backwards', async () => {
      const clock = noonClock();
      const { result, rerender, save, finishDaily } = await dailyHook(clock);
      await finishDaily('2026-09-26', 1840);

      clock.setToday('2026-09-25');
      await rerender({});
      expect(result.current.week.at(-1)).toMatchObject({ state: 'today', isToday: true });
      await finishDaily('2026-09-26', 500);

      clock.setToday('2026-09-26');
      await rerender({});
      expect(result.current.todayResult?.score).toBe(1840);
      expect(result.current.week.at(-1)?.state).toBe('done');
      expect(save.doc().daily.completed).toBe(1);
    });

    it('moves to the new day after local midnight, never a cached today', async () => {
      const clock = noonClock();
      const { result, rerender } = await dailyHook(clock);

      clock.advance(12 * 3_600_000 + 60_000);
      await rerender({});

      expect(result.current.dayText).toBe('27');
      expect(stripIsolates(result.current.dateText)).toBe('Sunday, 27 Sep');
      expect(result.current.week.at(-1)).toMatchObject({ weekdayName: 'Sunday', isToday: true });
    });

    it('counts down to the next challenge after today is played', async () => {
      const clock = noonClock(11_100_000);
      const { result, rerender, finishDaily } = await dailyHook(clock);
      await finishDaily('2026-09-26', 1840);
      expect(result.current.todayResult).toMatchObject({ hours: 3, minutes: 5 });

      clock.advance(600_000);
      await rerender({});

      expect(result.current.todayResult).toMatchObject({ hours: 2, minutes: 55 });
    });

    it("ticks no countdown clock until today's result shows, then one", async () => {
      const interval = jest.spyOn(globalThis, 'setInterval');
      try {
        const { finishDaily } = await dailyHook(noonClock());
        expect(interval).not.toHaveBeenCalled();

        await finishDaily('2026-09-26', 1840);

        expect(interval).toHaveBeenCalledTimes(1);
      } finally {
        interval.mockRestore();
      }
    });

    it('writes the day of the month in Persian digits in fa (spec 7.3)', async () => {
      const clock = createFakeClock({ nowMs: 1_790_510_400_000, today: '2026-09-27' });
      const { result } = await dailyHook(clock, { language: 'fa' });

      expect(result.current.dayText).toBe('۲۷');
    });

    it("resumes today's saved daily from Play instead of starting over it (N10)", async () => {
      mockNavigate.mockClear();
      const clock = noonClock();
      const { result, shell } = await dailyHook(clock);
      shell.host.openSession({ start: 'new', ref: { kind: 'daily', date: '2026-09-26' } });

      result.current.onPlay();

      expect(mockNavigate.mock.calls).toStrictEqual([['Game', { start: 'resume' }]]);
    });

    it("starts today's daily over a saved run of another day or mode", async () => {
      mockNavigate.mockClear();
      const clock = noonClock();
      const { result, shell } = await dailyHook(clock);
      shell.host.openSession({ start: 'new', ref: { kind: 'daily', date: '2026-09-25' } });
      result.current.onPlay();
      shell.host.openSession({ start: 'new', ref: { kind: 'level', level: 1 } });
      result.current.onReplay();

      const today = { start: 'new', ref: { kind: 'daily', date: '2026-09-26' } };
      expect(mockNavigate.mock.calls).toStrictEqual([
        ['Game', today],
        ['Game', today],
      ]);
    });

    it('plays the day the clock says when Play is pressed, past midnight on an open S9', async () => {
      mockNavigate.mockClear();
      const clock = noonClock();
      const { result } = await dailyHook(clock);

      clock.advance(12 * 3_600_000 + 60_000);
      result.current.onPlay();

      expect(mockNavigate.mock.calls).toStrictEqual([
        ['Game', { start: 'new', ref: { kind: 'daily', date: '2026-09-27' } }],
      ]);
    });
  });
});
