// packages/shell/src/i18n/format-date.ts
import { isoWeekday } from '@e07/game-kit/dates/date-key.ts';

import { stripIsolates } from './bidi.ts';

import type { TFunction } from './create-t.ts';
import type { ShellMessageKey } from './messages.ts';
import type { DateKey } from '@e07/game-kit/dates/date-key.ts';

// Month names come from the catalogs (Gregorian in all four languages).
// Never use Intl.DateTimeFormat or Date#toLocale*: Hermes picks the Solar Hijri
// calendar for fa and ignores the digit choice. Keys are literals, never built.
const MONTH_SHORT_KEYS = [
  'date.month-short.1',
  'date.month-short.2',
  'date.month-short.3',
  'date.month-short.4',
  'date.month-short.5',
  'date.month-short.6',
  'date.month-short.7',
  'date.month-short.8',
  'date.month-short.9',
  'date.month-short.10',
  'date.month-short.11',
  'date.month-short.12',
] as const satisfies readonly ShellMessageKey[];

// Indexed by isoWeekday(date) - 1 (1 = Monday), from @e07/game-kit/dates/date-key.ts.
const WEEKDAY_KEYS = [
  'date.weekday.1',
  'date.weekday.2',
  'date.weekday.3',
  'date.weekday.4',
  'date.weekday.5',
  'date.weekday.6',
  'date.weekday.7',
] as const satisfies readonly ShellMessageKey[];

// The week strip's column heads: short names in en/de, single letters in fa/ckb.
const WEEKDAY_STRIP_KEYS = [
  'date.weekday-strip.1',
  'date.weekday-strip.2',
  'date.weekday-strip.3',
  'date.weekday-strip.4',
  'date.weekday-strip.5',
  'date.weekday-strip.6',
  'date.weekday-strip.7',
] as const satisfies readonly ShellMessageKey[];

function monthOf(date: DateKey): number {
  return Number(date.slice(5, 7));
}

/** '2026-09-26' -> 26: the day of the month (S9's calendar tile formats it in the chosen digits). */
export function dayOf(date: DateKey): number {
  return Number(date.slice(8, 10));
}

// '2026-09-26' -> "Sep" / "Sept." / "سپتامبر" / "ئەیلوول" (the S9 calendar tile's month).
export function formatMonthShort(date: DateKey, t: TFunction): string {
  return t(MONTH_SHORT_KEYS[monthOf(date) - 1] ?? 'date.month-short.1');
}

// '2026-09-26' -> "Saturday" (the week strip's and the bar chart's VoiceOver names).
export function formatWeekdayName(date: DateKey, t: TFunction): string {
  return t(WEEKDAY_KEYS[isoWeekday(date) - 1] ?? 'date.weekday.1');
}

// '2026-09-26' -> the week strip's column head ("Sa" in en, one letter in fa/ckb).
export function formatWeekdayLetter(date: DateKey, t: TFunction): string {
  return t(WEEKDAY_STRIP_KEYS[isoWeekday(date) - 1] ?? 'date.weekday-strip.1');
}

/** S9's week strip and S10's bars: a day's column letter and its VoiceOver name together. */
export function formatWeekdayLabels(
  date: DateKey,
  t: TFunction,
): { readonly letter: string; readonly weekdayName: string } {
  return { letter: formatWeekdayLetter(date, t), weekdayName: formatWeekdayName(date, t) };
}

// '2026-09-26' -> "26 Sep" / "26. Sept." / "۲۶ سپتامبر" / "۲۶ی ئەیلوول" (catalog + digits).
// The month comes back isolated (FSI…PDI): pass the result into another message only as
// stripIsolates(formatDayMonth(…)), or the nested isolates flip the date in fa (nested-isolates).
export function formatDayMonth(date: DateKey, t: TFunction): string {
  return t('date.day-month', { day: dayOf(date), monthName: formatMonthShort(date, t) });
}

// '2026-09-26' -> "Saturday, 26 Sep" (S4's daily card and the S9 date line). Isolated inside, like
// formatDayMonth: strip it before it becomes a *Text value of another message.
export function formatWeekdayDayMonth(date: DateKey, t: TFunction): string {
  return t('date.weekday-day-month', {
    weekdayName: formatWeekdayName(date, t),
    day: dayOf(date),
    monthName: formatMonthShort(date, t),
  });
}

// '2026-09-27' -> "27 Sep 2026" (S11c's privacy.updated sentence, which isolates it as dateText).
// The month (a *Name placeholder) comes back isolated too; nested, that isolate hid the only strong
// letter from the outer one, which then ran left to right ("۲۰۲۶ سپتامبر ۲۷" in fa). A date is one
// run of its language: the inner isolate is dropped here.
export function formatDayMonthYear(date: DateKey, t: TFunction): string {
  return stripIsolates(
    t('date.day-month-year', {
      day: dayOf(date),
      monthName: formatMonthShort(date, t),
      year: Number(date.slice(0, 4)),
    }),
  );
}
