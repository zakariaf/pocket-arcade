// packages/shell/src/i18n/digits.test.ts
import { createNumberFormatter } from './create-number-formatter.ts';
import { localeTagFor } from './digits.ts';

describe('localeTagFor + createNumberFormatter', () => {
  it.each([
    ['en', 'automatic', '1,234,568'],
    ['de', 'automatic', '1.234.568'],
    ['fa', 'automatic', '۱٬۲۳۴٬۵۶۸'],
    ['ckb', 'automatic', '۱٬۲۳۴٬۵۶۸'],
    ['ckb', 'local', '۱٬۲۳۴٬۵۶۸'],
    ['de', 'local', '1.234.568'],
  ] as const)('formats 1234567.89 in %s with %s digits', (language, digits, expected) => {
    expect(createNumberFormatter(localeTagFor(language, digits))(1234567.89)).toBe(expected);
  });

  it('switches Persian to Latin digits when the player picks Latin', () => {
    expect(createNumberFormatter(localeTagFor('fa', 'latin'))(123)).toMatch(/^123$/);
  });

  it('gives Sorani the Persian-style digits, not the CLDR Arabic-Indic default', () => {
    expect(createNumberFormatter(localeTagFor('ckb', 'automatic'))(123)).toBe('۱۲۳');
    expect(new Intl.NumberFormat('ckb').format(123)).toBe('١٢٣');
  });

  it('uses the Persian decimal and percent signs', () => {
    const tag = localeTagFor('ckb', 'automatic');
    expect(new Intl.NumberFormat(tag).format(1234.5)).toBe('۱٬۲۳۴٫۵');
    expect(new Intl.NumberFormat(tag, { style: 'percent' }).format(0.42)).toBe('۴۲٪');
  });
});
