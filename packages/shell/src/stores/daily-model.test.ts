// packages/shell/src/stores/daily-model.test.ts
import { addDays } from '@e07/game-kit/dates/date-key.ts';
import { createDefaultSaveDoc } from '@e07/shell/services/save/schema/default-save-doc.ts';

import {
  currentDailyStreak,
  DAILY_KEEP_DAYS,
  isDailyDone,
  lastSevenDays,
  recordDailyResult,
} from './daily-model.ts';

import type { DailySection } from './daily-model.ts';

const EMPTY = createDefaultSaveDoc('line-siege').daily;
const WIN = { won: true, score: 120, moves: 9, playMs: 60_000 };
const LOSS = { won: false, score: 10, moves: 4, playMs: 20_000 };

function played(days: readonly string[]): DailySection {
  return days.reduce((acc, date) => recordDailyResult(acc, date, WIN), EMPTY);
}

describe('daily-model', () => {
  it('counts consecutive days and keeps the best streak', () => {
    const daily = played(['2026-09-24', '2026-09-25', '2026-09-26']);
    expect(currentDailyStreak(daily, '2026-09-26')).toBe(3);
    expect(currentDailyStreak(daily, '2026-09-27')).toBe(3);
    expect(currentDailyStreak(daily, '2026-09-28')).toBe(0);
    expect(daily.bestStreak).toBe(3);
  });

  it('starts a new streak after a missed day but keeps the best one', () => {
    const daily = played(['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-24']);
    expect(daily.streak).toStrictEqual({ lastDate: '2026-09-24', length: 1 });
    expect(daily.bestStreak).toBe(3);
  });

  it('counts a lost first attempt as the day played', () => {
    const daily = recordDailyResult(EMPTY, '2026-09-26', LOSS);
    expect(isDailyDone(daily, '2026-09-26')).toBe(true);
    expect(currentDailyStreak(daily, '2026-09-26')).toBe(1);
  });

  it('keeps the first result of a day: a replay changes nothing', () => {
    const first = recordDailyResult(EMPTY, '2026-09-26', LOSS);
    expect(recordDailyResult(first, '2026-09-26', WIN)).toBe(first);
  });

  it('keeps the streak unchanged when the clock goes backwards', () => {
    const later = recordDailyResult(EMPTY, '2026-09-26', WIN);
    const earlier = recordDailyResult(later, '2026-09-20', WIN);
    expect(earlier.streak).toStrictEqual(later.streak);
    expect(isDailyDone(earlier, '2026-09-26')).toBe(true);
    expect(isDailyDone(earlier, '2026-09-20')).toBe(true);
  });

  it('prunes results older than the keep window without shortening the streak', () => {
    const days = Array.from({ length: DAILY_KEEP_DAYS + 5 }, (_, i) => addDays('2026-01-01', i));
    const daily = played(days);
    expect(Object.keys(daily.results)).toHaveLength(DAILY_KEEP_DAYS);
    expect(daily.streak).toStrictEqual({ lastDate: days.at(-1), length: DAILY_KEEP_DAYS + 5 });
    expect(daily.completed).toBe(DAILY_KEEP_DAYS + 5);
  });

  it('lists the last seven days oldest first, with done marks', () => {
    const daily = played(['2026-09-21', '2026-09-26']);
    expect(lastSevenDays(daily, '2026-09-26')).toStrictEqual([
      { date: '2026-09-20', isDone: false },
      { date: '2026-09-21', isDone: true },
      { date: '2026-09-22', isDone: false },
      { date: '2026-09-23', isDone: false },
      { date: '2026-09-24', isDone: false },
      { date: '2026-09-25', isDone: false },
      { date: '2026-09-26', isDone: true },
    ]);
  });
});
