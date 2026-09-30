// packages/shell/src/screens/daily/use-daily-model.ts
// S9's model hook: the daily summary (daily-and-statistics), the next-day countdown (read on every
// render, so it keeps ticking once today is done), the date texts from the Shell's date formatter
// and the Game route for today's challenge. DailyView only draws what this returns.
import { useNavigation } from '@react-navigation/native';

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
import { selectDigits } from '@e07/shell/stores/settings-selectors.ts';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

import type { DailyModel } from './daily-model.ts';

export function useDailyModel(): DailyModel {
  const t = useT();
  const navigation = useNavigation();
  const summary = useDailySummary();
  const countdown = useNextDayCountdown();
  const formatNumber = createNumberFormatter(
    localeTagFor(useLanguage(), useSettingsStore(selectDigits)),
  );
  const { today } = summary;
  // The first finished attempt of the day counts; a replay never changes it (the game host).
  const playToday = (): void => {
    navigation.navigate('Game', { start: 'new', ref: { kind: 'daily', date: today } });
  };
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
