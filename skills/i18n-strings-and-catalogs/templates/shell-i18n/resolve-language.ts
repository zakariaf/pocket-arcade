// packages/shell/src/i18n/resolve-language.ts
import type { Language } from './languages.ts';

// The two fields we read from expo-localization's getLocales() entries.
export type DeviceLocale = {
  readonly languageCode: string | null;
  readonly languageScriptCode: string | null;
};

// 'prs' is Dari (counts as Persian). 'ku' is decided by script below; 'kmr' is Latin Kurmanji.
const BY_CODE: Readonly<Record<string, Language>> = {
  en: 'en',
  de: 'de',
  fa: 'fa',
  prs: 'fa',
  ckb: 'ckb',
};

// Maps one device locale to a supported language, or null to try the next one.
export function languageFromDeviceLocale(locale: DeviceLocale): Language | null {
  const code = locale.languageCode?.toLowerCase() ?? '';
  if (code === 'ku') return locale.languageScriptCode === 'Arab' ? 'ckb' : null;
  return BY_CODE[code] ?? null;
}

// Saved choice wins, then the first supported device language, then English.
export function resolveLanguage(
  saved: Language | null,
  deviceLocales: readonly DeviceLocale[],
): Language {
  if (saved !== null) return saved;
  for (const locale of deviceLocales) {
    const language = languageFromDeviceLocale(locale);
    if (language !== null) return language;
  }
  return 'en';
}
