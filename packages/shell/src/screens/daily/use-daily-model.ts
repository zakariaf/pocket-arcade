// packages/shell/src/screens/daily/use-daily-model.ts
// S9's model hook: the daily summary (daily-and-statistics), the next-day countdown (read on every
// render, ticking only while today's result shows on a focused S9), the date texts from the Shell's
// date formatter and the Game route for today's challenge. DailyView only draws what this returns.
import { useIsFocused, useNavigation } from '@react-navigation/native';

import { useServices } from '@e07/shell/app/services-context.tsx';
import { useReduceMotion } from '@e07/shell/app/use-reduce-motion.ts';
import { createNumberFormatter } from '@e07/shell/i18n/create-number-formatter.ts';
import { localeTagFor } from '@e07/shell/i18n/digits.ts';
import {
  formatMonthShort,
  formatWeekdayDayMonth,
  formatWeekdayLetter,
  formatWeekdayName,
} from '@e07/shell/i18n/format-date.ts';
import { useLanguage } from '@e07/shell/i18n/language-context.tsx';
import { useT } from '@e07/shell/i18n/t-context.ts';
import { useDailySummary } from '@e07/shell/screens/daily/use-daily-summary.ts';
import { useNextDayCountdown } from '@e07/shell/screens/daily/use-next-day-countdown.ts';
import { usePlayRun } from '@e07/shell/screens/home/use-play-run.ts';
import { selectDigits } from '@e07/shell/stores/settings-selectors.ts';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

import type { DailyModel } from './daily-model.ts';

/**
 * Play and Replay: today's challenge, the day read from the clock when the key is pressed (S9: the
 * day changes at local midnight, also while S9 stays open), through usePlayRun: today's saved daily
 * resumes, as Home's daily key does, and is never replaced by a new one (N10, 8.6). The first
 * finished attempt of the day counts; a replay never changes it (the game host).
 */
function usePlayToday(): () => void {
  const playRun = usePlayRun();
  const { clock } = useServices();
  return () => {
    playRun({ kind: 'daily', date: clock.today() });
  };
}

export function useDailyModel(): DailyModel {
  const t = useT();
  const navigation = useNavigation();
  const summary = useDailySummary();
  // The countdown ticks only while today's result shows on a focused S9 (never under Game).
  const isFocused = useIsFocused();
  const countdown = useNextDayCountdown(summary.todayResult !== null && isFocused);
  const formatNumber = createNumberFormatter(
    localeTagFor(useLanguage(), useSettingsStore(selectDigits)),
  );
  const { today } = summary;
  const playToday = usePlayToday();
  return {
    monthText: formatMonthShort(today, t),
    dayText: formatNumber(Number(today.slice(8, 10))),
    dateText: formatWeekdayDayMonth(today, t),
    todayResult:
      summary.todayResult === null ? null : { score: summary.todayResult.score, ...countdown },
    currentStreak: summary.currentStreak,
    bestStreak: summary.bestStreak,
    week: summary.week.map((day) => ({
      letter: formatWeekdayLetter(day.date, t),
      weekdayName: formatWeekdayName(day.date, t),
      state: day.mark,
      isToday: day.isToday,
    })),
    isReducedMotion: useReduceMotion(),
    onBack: () => {
      navigation.goBack();
    },
    onPlay: playToday,
    onReplay: playToday,
  };
}
