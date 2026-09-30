// packages/shell/src/screens/daily/daily-summary.ts
import { isoWeekday } from '@e07/game-kit/dates/date-key.ts';
import { currentDailyStreak, isDailyDone, lastSevenDays } from '@e07/shell/stores/daily-model.ts';

import type { DateKey } from '@e07/game-kit/dates/date-key.ts';
import type { DailyResult, DailySection } from '@e07/shell/stores/daily-model.ts';

/** S9 week strip marks (Toybox: done = accent + check, missed = dashed + cross, today = play). */
export type DailyMark = 'done' | 'missed' | 'today';

export type DailyWeekDay = {
  readonly date: DateKey;
  /** ISO weekday 1..7 (1 = Monday): the letter date.weekday-strip.<n> and the name date.weekday.<n>. */
  readonly weekday: number;
  readonly mark: DailyMark;
  readonly isToday: boolean;
};

/** Everything S9, the Home daily card and the daily result show. Pure data, no text. */
export type DailySummary = {
  readonly today: DateKey;
  readonly isDone: boolean;
  /** Today's recorded (first) result, or null before today's first finished attempt. */
  readonly todayResult: DailyResult | null;
  readonly currentStreak: number;
  readonly bestStreak: number;
  /** Seven days, oldest first; laid out in a row, so RTL mirrors it. */
  readonly week: readonly DailyWeekDay[];
};

/** "Next challenge in {hours} h {minutes} min" (daily.next-in), shown after today's game. */
export type Countdown = { readonly hours: number; readonly minutes: number };

const MINUTE_MS = 60_000;

/**
 * Pure: ClockPort.msUntilNextLocalDay() -> whole hours and minutes, rounded UP to the minute,
 * so the line never reads "0 h 0 min" while today is still running (11_100_000 -> 3 h 5 min).
 */
export function splitCountdown(msUntilNextDay: number): Countdown {
  const totalMinutes = Math.max(0, Math.ceil(msUntilNextDay / MINUTE_MS));
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

function markOf(isDone: boolean, isToday: boolean): DailyMark {
  if (isDone) return 'done';
  return isToday ? 'today' : 'missed';
}

/** Pure: the daily section + today -> the S9 view model. Components only format it. */
export function buildDailySummary(daily: DailySection, _today: DateKey): DailySummary {
  const today = new Date().toISOString().slice(0, 10);
  const week = lastSevenDays(daily, today).map(({ date, isDone }): DailyWeekDay => {
    const isToday = date === today;
    return { date, weekday: isoWeekday(date), mark: markOf(isDone, isToday), isToday };
  });
  return {
    today,
    isDone: isDailyDone(daily, today),
    todayResult: daily.results[today] ?? null,
    currentStreak: currentDailyStreak(daily, today),
    bestStreak: daily.bestStreak,
    week,
  };
}
