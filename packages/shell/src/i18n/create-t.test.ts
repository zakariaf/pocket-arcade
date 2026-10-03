// packages/shell/src/i18n/create-t.test.ts
import { createIntl } from 'react-intl';

import { FSI, PDI } from './bidi.ts';
import { createT } from './create-t.ts';
import { localeTagFor } from './digits.ts';
import { messagesFor } from './messages.ts';

import type { TFunction } from './create-t.ts';
import type { DigitStyle } from './digits.ts';
import type { Language } from './languages.ts';

const NO_GAME = { en: {}, de: {}, fa: {}, ckb: {} } as const;

function failOnError(error: Error): never {
  throw error;
}

function tFor(
  language: Language,
  digits: DigitStyle = 'automatic',
  onError: (error: Error) => void = failOnError,
): TFunction {
  const intl = createIntl({
    locale: localeTagFor(language, digits),
    messages: messagesFor(language, NO_GAME),
    defaultLocale: 'en',
    onError,
  });
  return createT({ intl, onError });
}

describe('t()', () => {
  it.each([
    ['en', 1, '1 move – par 7'],
    ['en', 0, '0 moves – par 7'],
    ['de', 1, '1 Zug – Par 7'],
    ['de', 2, '2 Züge – Par 7'],
    ['fa', 0, '۰ حرکت – هدف ۷'],
    ['ckb', 3, '۳ جووڵە – ئامانج ۷'],
  ] as const)('pluralises and localises digits: %s, %i moves', (language, movesCount, expected) => {
    expect(tFor(language)('result.win.moves', { movesCount, par: 7 })).toBe(expected);
  });

  it('prefers an exact =0 branch over the Persian "one" category (which holds 0)', () => {
    expect(tFor('en')('daily.streak.count', { daysCount: 0 })).toBe('No streak yet');
    expect(tFor('fa')('daily.streak.count', { daysCount: 0 })).toMatch(/^هنوز /);
    expect(tFor('fa')('daily.streak.count', { daysCount: 1 })).toBe('۱ روز پیاپی');
  });

  it('keeps Latin digits when the player picked them', () => {
    expect(tFor('ckb', 'latin')('home.play-button.continue', { level: 12 })).toBe(
      'بەردەوامبوون – ئاستی 12',
    );
  });

  it('formats percentages with the language digits and sign', () => {
    expect(tFor('fa')('stats.win-rate', { rate: 0.42 })).toBe('درصد برد ۴۲٪');
  });

  it('isolates free-text placeholders with FSI ... PDI', () => {
    expect(tFor('fa')('levels.pack.locked', { starsCount: 2, packName: 'Beginnings' })).toBe(
      `برای باز کردن ${FSI}Beginnings${PDI}، ۲ ستارهٔ دیگر جمع کنید.`,
    );
  });

  it('reports a number passed to a text placeholder', () => {
    const onError = jest.fn();
    tFor('en', 'automatic', onError)('levels.pack.locked', { starsCount: 2, packName: 3 });
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('packName') }),
    );
  });
});
