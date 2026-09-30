// packages/shell/src/i18n/languages.ts
export const LANGUAGES = ['en', 'de', 'fa', 'ckb'] as const;
export type Language = (typeof LANGUAGES)[number];
export type Direction = 'ltr' | 'rtl';

const RTL_LANGUAGES: ReadonlySet<Language> = new Set<Language>(['fa', 'ckb']);

// Each language's name in its own language and script (S2, S11a).
// Deliberately NOT in the catalogs: translators must never change them.
export const LANGUAGE_AUTONYMS: Readonly<Record<Language, string>> = {
  en: 'English',
  de: 'Deutsch',
  fa: 'فارسی',
  ckb: 'کوردیی ناوەندی',
};

export function directionOf(language: Language): Direction {
  return RTL_LANGUAGES.has(language) ? 'rtl' : 'ltr';
}

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}
