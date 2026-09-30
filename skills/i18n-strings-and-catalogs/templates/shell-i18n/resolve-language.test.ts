// packages/shell/src/i18n/resolve-language.test.ts
import { LANGUAGE_AUTONYMS } from './languages.ts';
import { resolveLanguage } from './resolve-language.ts';

import type { DeviceLocale } from './resolve-language.ts';

function device(languageCode: string, languageScriptCode: string | null = null): DeviceLocale {
  return { languageCode, languageScriptCode };
}

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
