// packages/shell/src/screens/settings/language/language-change.ts
// Pure: what choosing a row in S11a (or an option in S2) does. The text switches at once
// (the store change re-renders I18nProvider); a direction flip also needs the S14
// "Restart to apply" dialog, because React Native cannot mirror the layout live.
import { directionOf } from '@e07/shell/i18n/languages.ts';
import { resolveLanguage } from '@e07/shell/i18n/resolve-language.ts';

import type { Direction, Language } from '@e07/shell/i18n/languages.ts';
import type { DeviceLocale } from '@e07/shell/i18n/resolve-language.ts';
import type { SettingsAction } from '@e07/shell/stores/settings-reducer.ts';

export type LanguageChangeInput = {
  /** The row: a language, or null for "System (…)". */
  readonly next: Language | null;
  /** expo-localization getLocales(), read once at startup. */
  readonly deviceLocales: readonly DeviceLocale[];
  /** readLayoutDirection(): the layout's direction right now, not the language's. */
  readonly layoutDirection: Direction;
};

export type LanguageChange = {
  readonly action: SettingsAction;
  /** The language the app will actually use (System resolves against the phone). */
  readonly resolved: Language;
  /** True when the new language reads the other way: show the restart dialog. */
  readonly needsRestart: boolean;
};

export function planLanguageChange(input: LanguageChangeInput): LanguageChange {
  const resolved = resolveLanguage(input.next, input.deviceLocales);
  return {
    action: { type: 'set-language', language: input.next },
    resolved,
    needsRestart: directionOf(resolved) !== input.layoutDirection,
  };
}
