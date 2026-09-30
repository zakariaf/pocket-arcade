// packages/shell/src/i18n/intl-status.test.ts
import { areIntlPolyfillsActive } from './intl-status.ts';

describe('areIntlPolyfillsActive', () => {
  it('is true in Jest, because setupFiles loads the forced polyfills first', () => {
    expect(areIntlPolyfillsActive()).toBe(true);
  });

  it('formats Sorani numbers with Persian digits and separators, as on the phone', () => {
    expect(new Intl.NumberFormat('ckb-u-nu-arabext').format(1234.5)).toBe('۱٬۲۳۴٫۵');
  });

  it('puts zero in the Persian "one" category (why =0 must exist in every language)', () => {
    expect(new Intl.PluralRules('fa').select(0)).toBe('one');
  });
});
