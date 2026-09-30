// packages/shell/src/i18n/format-date.test.ts
import { createIntl } from 'react-intl';

import { stripIsolates } from './bidi.ts';
import { createT } from './create-t.ts';
import { localeTagFor } from './digits.ts';
import {
  formatDayMonth,
  formatMonthShort,
  formatWeekdayDayMonth,
  formatWeekdayLetter,
  formatWeekdayName,
} from './format-date.ts';
import { messagesFor } from './messages.ts';

import type { TFunction } from './create-t.ts';
import type { Language } from './languages.ts';

const NO_GAME = { en: {}, de: {}, fa: {}, ckb: {} } as const;

function failOnError(error: Error): never {
  throw error;
}

function tFor(language: Language): TFunction {
  const intl = createIntl({
    locale: localeTagFor(language, 'automatic'),
    messages: messagesFor(language, NO_GAME),
    defaultLocale: 'en',
    onError: failOnError,
  });
  return createT({ intl, onError: failOnError });
}

describe('formatDayMonth', () => {
  it.each([
    ['en', '26 Sep'],
    ['de', '26. Sept.'],
    ['fa', '۲۶ سپتامبر'],
    ['ckb', '۲۶ی ئەیلوول'],
  ] as const)(
    'formats 2026-09-26 in %s with Gregorian months and its digits',
    (language, expected) => {
      expect(stripIsolates(formatDayMonth('2026-09-26', tFor(language)))).toBe(expected);
    },
  );
});

describe('the weekday and month helpers', () => {
  it('names 2026-09-26, a Saturday, from the catalogs', () => {
    const t = tFor('en');
    expect([
      formatMonthShort('2026-09-26', t),
      formatWeekdayName('2026-09-26', t),
      stripIsolates(formatWeekdayDayMonth('2026-09-26', t)),
    ]).toStrictEqual(['Sep', 'Saturday', 'Saturday, 26 Sep']);
  });

  it('gives the week strip one head per ISO weekday, Monday first', () => {
    const t = tFor('en');
    const week = [
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
    ] as const;
    expect(new Set(week.map((date) => formatWeekdayLetter(date, t))).size).toBe(7);
  });
});
