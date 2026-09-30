// packages/shell/src/stores/daily-model.ts
import { addDays, daysBetween } from '@e07/game-kit/dates/date-key.ts';

import type { DateKey } from '@e07/game-kit/dates/date-key.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

export type DailySection = SaveDoc['daily'];
export type DailyResult = DailySection['results'][string];

/** Results older than this are pruned on write; the streak itself is stored incrementally. */
export const DAILY_KEEP_DAYS = 60;

function nextStreak(streak: DailySection['streak'], date: DateKey): DailySection['streak'] {
  if (streak.lastDate === null) return { lastDate: date, length: 1 };
  const gap = daysBetween(streak.lastDate, date);
  if (gap === 1) return { lastDate: date, length: streak.length + 1 };
  return { lastDate: date, length: 1 }; // same day or the clock went backwards: never double-count (spec S9)
}

function pruned(results: DailySection['results'], newest: DateKey): DailySection['results'] {
  return Object.fromEntries(
    Object.entries(results).filter(([date]) => daysBetween(date, newest) < DAILY_KEEP_DAYS),
  );
}

/**
 * Spec S9: the FIRST finished attempt of `date` (won or lost) counts; replays change nothing.
 * `date` is the run's own ref.date, so a run finished after midnight counts for the day it began.
 */
export function recordDailyResult(
  daily: DailySection,
  date: DateKey,
  result: DailyResult,
): DailySection {
  if (date in daily.results) return daily;
  const streak = nextStreak(daily.streak, date);
  const newest = streak.lastDate ?? date;
  return {
    results: pruned({ ...daily.results, [date]: result }, newest),
    // Results are pruned; the all-time count (S10 "Challenges completed") is kept apart.
    completed: daily.completed + 1,
    streak,
    bestStreak: Math.max(daily.bestStreak, streak.length),
  };
}

/** "Played yesterday or today" (spec S9): the streak survives until the end of tomorrow. */
export function currentDailyStreak(daily: DailySection, today: DateKey): number {
  if (daily.streak.lastDate === null) return 0;
  const gap = daysBetween(daily.streak.lastDate, today);
  return gap === 0 || gap === 1 ? daily.streak.length : 0;
}

export function isDailyDone(daily: DailySection, today: DateKey): boolean {
  return today in daily.results;
}

/** Oldest first. The strip is laid out with flexDirection 'row', so RTL mirrors it. */
export function lastSevenDays(
  daily: DailySection,
  today: DateKey,
): readonly { readonly date: DateKey; readonly isDone: boolean }[] {
  return [6, 5, 4, 3, 2, 1, 0].map((back) => {
    const date = addDays(today, -back);
    return { date, isDone: date in daily.results };
  });
}
