// packages/shell/src/screens/daily/daily-summary.test.ts
import { createDefaultSaveDoc } from '@e07/shell/services/save/schema/default-save-doc.ts';
import { recordDailyResult } from '@e07/shell/stores/daily-model.ts';

import { buildDailySummary, splitCountdown } from './daily-summary.ts';

const EMPTY = createDefaultSaveDoc('line-siege').daily;
const WIN = { won: true, score: 120, moves: 9, playMs: 60_000 };

describe('buildDailySummary', () => {
  it('shows a new player: nothing done, today marked to play, all else missed', () => {
    const view = buildDailySummary(EMPTY, '2026-09-26');
    expect(view.isDone).toBe(false);
    expect(view.todayResult).toBeNull();
    expect(view.currentStreak).toBe(0);
    expect(view.week.map((day) => day.mark)).toStrictEqual([
      'missed',
      'missed',
      'missed',
      'missed',
      'missed',
      'missed',
      'today',
    ]);
  });

  it('shows today done with its first result and the streak', () => {
    const daily = ['2026-09-25', '2026-09-26'].reduce(
      (acc, date) => recordDailyResult(acc, date, WIN),
      EMPTY,
    );
    const view = buildDailySummary(daily, '2026-09-26');
    expect(view.isDone).toBe(true);
    expect(view.todayResult).toStrictEqual(WIN);
    expect(view.currentStreak).toBe(2);
    expect(view.week.at(-1)).toStrictEqual({
      date: '2026-09-26',
      weekday: 6,
      mark: 'done',
      isToday: true,
    });
    expect(view.week.map((day) => day.weekday)).toStrictEqual([7, 1, 2, 3, 4, 5, 6]);
    expect(view.week.at(-2)?.mark).toBe('done');
  });

  it("keeps yesterday's streak alive until today is played", () => {
    const daily = recordDailyResult(EMPTY, '2026-09-25', WIN);
    const view = buildDailySummary(daily, '2026-09-26');
    expect(view.isDone).toBe(false);
    expect(view.currentStreak).toBe(1);
    expect(view.bestStreak).toBe(1);
  });
});

describe('splitCountdown', () => {
  it('splits the time to midnight into whole hours and minutes', () => {
    expect(splitCountdown(11_100_000)).toStrictEqual({ hours: 3, minutes: 5 });
  });

  it('rounds up, so the last seconds of the day still read one minute', () => {
    expect([splitCountdown(30_000), splitCountdown(3_600_001)]).toStrictEqual([
      { hours: 0, minutes: 1 },
      { hours: 1, minutes: 1 },
    ]);
  });

  it('reads a full day right after midnight', () => {
    expect(splitCountdown(86_400_000)).toStrictEqual({ hours: 24, minutes: 0 });
  });
});
