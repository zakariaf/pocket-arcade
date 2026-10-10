// packages/shell/src/screens/settings/language/language-change.test.ts
import { FSI, PDI } from '@e07/shell/i18n/bidi.ts';
import { createLanguageT } from '@e07/shell/i18n/create-language-t.ts';

import { planLanguageChange, restartDirectionOf, systemLabel } from './language-change.ts';

const ENGLISH_PHONE = [{ languageCode: 'en', languageScriptCode: null }];
const PERSIAN_PHONE = [{ languageCode: 'fa', languageScriptCode: null }];

describe('planLanguageChange', () => {
  it('switches the text at once when the direction stays the same', () => {
    const change = planLanguageChange({
      next: 'de',
      deviceLocales: ENGLISH_PHONE,
      layoutDirection: 'ltr',
    });
    expect(change).toStrictEqual({
      action: { type: 'set-language', language: 'de' },
      resolved: 'de',
      needsRestart: false,
    });
  });

  it('asks for a restart when the new language reads the other way', () => {
    const change = planLanguageChange({
      next: 'ckb',
      deviceLocales: ENGLISH_PHONE,
      layoutDirection: 'ltr',
    });
    expect(change.needsRestart).toBe(true);
  });

  it('resolves System against the phone before comparing directions', () => {
    const change = planLanguageChange({
      next: null,
      deviceLocales: PERSIAN_PHONE,
      layoutDirection: 'ltr',
    });
    expect(change.resolved).toBe('fa');
    expect(change.needsRestart).toBe(true);
    expect(change.action).toStrictEqual({ type: 'set-language', language: null });
  });
});

// Spec S2, S11a and 7.2: only a language that reads the other way restarts the app, and the
// restart goes to that language's direction (System resolved against the phone first).
describe('restartDirectionOf', () => {
  it.each([
    { next: 'de', deviceLocales: ENGLISH_PHONE, layoutDirection: 'ltr', expected: null },
    { next: 'ckb', deviceLocales: ENGLISH_PHONE, layoutDirection: 'ltr', expected: 'rtl' },
    { next: 'en', deviceLocales: PERSIAN_PHONE, layoutDirection: 'rtl', expected: 'ltr' },
    { next: null, deviceLocales: PERSIAN_PHONE, layoutDirection: 'ltr', expected: 'rtl' },
    { next: null, deviceLocales: PERSIAN_PHONE, layoutDirection: 'rtl', expected: null },
  ] as const)(
    'restarts for $next laid out $layoutDirection: $expected',
    ({ expected, ...input }) => {
      expect(restartDirectionOf(planLanguageChange(input))).toBe(expected);
    },
  );
});

describe('systemLabel', () => {
  it('names the System row after the language it resolves to, isolated (spec S11, S11a)', () => {
    const t = createLanguageT('en', 'automatic', (error) => {
      throw error;
    });
    expect([systemLabel(t, 'en'), systemLabel(t, 'fa')]).toStrictEqual([
      `System (${FSI}English${PDI})`,
      `System (${FSI}فارسی${PDI})`,
    ]);
  });
});
