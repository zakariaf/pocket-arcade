// packages/shell/src/i18n/digits.ts
import type { Language } from './languages.ts';

export type DigitStyle = 'automatic' | 'latin' | 'local';

// BCP 47 tag handed to IntlProvider and to every Intl.NumberFormat.
// ckb's CLDR default is 'arab' (U+0660..); the product wants Persian-style 'arabext' (U+06F0..).
const TAGS: Readonly<Record<Language, Readonly<Record<DigitStyle, string>>>> = {
  en: { automatic: 'en', latin: 'en', local: 'en' },
  de: { automatic: 'de', latin: 'de', local: 'de' },
  fa: { automatic: 'fa-u-nu-arabext', latin: 'fa-u-nu-latn', local: 'fa-u-nu-arabext' },
  ckb: { automatic: 'ckb-u-nu-arabext', latin: 'ckb-u-nu-latn', local: 'ckb-u-nu-arabext' },
};

export function localeTagFor(language: Language, digits: DigitStyle): string {
  return TAGS[language][digits];
}
