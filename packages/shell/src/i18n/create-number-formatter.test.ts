// packages/shell/src/i18n/create-number-formatter.test.ts
import { createNumberFormatter, createPercentFormatter } from './create-number-formatter.ts';
import { localeTagFor } from './digits.ts';

describe('createPercentFormatter', () => {
  it.each([
    ['en', 'automatic', '62%'],
    // German puts a no-break space before the sign.
    ['de', 'automatic', '62\u00A0%'],
    ['fa', 'automatic', '۶۲٪'],
    ['ckb', 'automatic', '۶۲٪'],
    ['fa', 'latin', '62%'],
  ] as const)('shows a 0.62 win rate in %s with %s digits as %s', (language, digits, expected) => {
    expect(createPercentFormatter(localeTagFor(language, digits))(0.62)).toBe(expected);
  });

  it('rounds to a whole percentage (the S10 win rate has no decimals)', () => {
    expect(createPercentFormatter('en')(0.6249)).toBe('62%');
    expect(createPercentFormatter('en')(1)).toBe('100%');
  });

  it('formats plain numbers without a percent sign', () => {
    expect(createNumberFormatter(localeTagFor('fa', 'automatic'))(62)).toBe('۶۲');
  });
});
