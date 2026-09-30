// packages/shell/src/screens/daily/daily-model.ts
// What S9 Daily draws. use-daily-model.ts builds it from the daily store, the clock and the
// Shell date formatter (never Intl.DateTimeFormat or toLocaleDateString directly).
import type { WeekMarkState } from '@e07/shell/ui/week-mark.tsx';

export type WeekDayModel = {
  /** date.weekday-strip.<ISO weekday>: short names in en/de, single letters in fa/ckb. */
  readonly letter: string;
  /** date.weekday.<ISO weekday>, for the mark's VoiceOver label. */
  readonly weekdayName: string;
  /** done = played that day; missed = not played; today = today, not played yet. */
  readonly state: WeekMarkState;
  readonly isToday: boolean;
};

export type DailyTodayResult = {
  readonly score: number;
  /** Time to local midnight. */
  readonly hours: number;
  readonly minutes: number;
};

export type DailyModel = {
  /** The calendar tile: date.month-short.<m> and the day in the chosen digits. */
  readonly monthText: string;
  readonly dayText: string;
  /** date.weekday-day-month. */
  readonly dateText: string;
  /** null until today's challenge is finished; the first completion counts. */
  readonly todayResult: DailyTodayResult | null;
  readonly currentStreak: number;
  readonly bestStreak: number;
  /**
   * Exactly the last seven days, oldest first, ending today (runs right to left in fa/ckb).
   * WeekStrip keys the columns by position: daily.week-day.1 is the oldest, .7 is today.
   */
  readonly week: readonly WeekDayModel[];
  readonly isReducedMotion: boolean;
  readonly onBack: () => void;
  readonly onPlay: () => void;
  /** Replays are for fun: they never change the day's result. */
  readonly onReplay: () => void;
};
