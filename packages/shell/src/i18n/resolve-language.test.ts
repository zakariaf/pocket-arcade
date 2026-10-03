// packages/shell/src/i18n/resolve-language.test.ts
import fc from 'fast-check';

import { LANGUAGE_AUTONYMS, LANGUAGES } from './languages.ts';
import { resolveLanguage } from './resolve-language.ts';

import type { DeviceLocale } from './resolve-language.ts';

function device(languageCode: string, languageScriptCode: string | null = null): DeviceLocale {
  return { languageCode, languageScriptCode };
}

const ANY_DEVICE_LOCALE: fc.Arbitrary<DeviceLocale> = fc.record({
  languageCode: fc.option(
    fc.oneof(fc.constantFrom('en', 'de', 'fa', 'prs', 'ckb', 'ku', 'kmr'), fc.string()),
  ),
  languageScriptCode: fc.option(fc.constantFrom('Arab', 'Latn', 'Cyrl')),
});

describe('resolveLanguage', () => {
  it('keeps the saved choice whatever the phone says', () => {
    expect(resolveLanguage('de', [device('fa')])).toBe('de');
  });

  it.each([
    { locales: [device('ckb')], expected: 'ckb' },
    { locales: [device('ku', 'Arab')], expected: 'ckb' },
    { locales: [device('prs')], expected: 'fa' },
    { locales: [device('ku', 'Latn'), device('de')], expected: 'de' },
    { locales: [device('kmr')], expected: 'en' },
    { locales: [], expected: 'en' },
  ] as const)('picks $expected for the device list', ({ locales, expected }) => {
    expect(resolveLanguage(null, locales)).toBe(expected);
  });

  it('always gives one of the four languages for any phone (spec 7.2)', () => {
    fc.assert(
      fc.property(fc.array(ANY_DEVICE_LOCALE), (locales) => {
        expect(LANGUAGES).toContain(resolveLanguage(null, locales));
      }),
    );
  });

  it('returns any saved language unchanged (spec 7.2)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...LANGUAGES), fc.array(ANY_DEVICE_LOCALE), (saved, locales) => {
        expect(resolveLanguage(saved, locales)).toBe(saved);
      }),
    );
  });
});

describe('LANGUAGE_AUTONYMS', () => {
  it('pins each language name in its own script (never translated)', () => {
    expect(LANGUAGE_AUTONYMS).toStrictEqual({
      en: 'English',
      de: 'Deutsch',
      fa: 'فارسی',
      ckb: 'کوردیی ناوەندی',
    });
  });
});
