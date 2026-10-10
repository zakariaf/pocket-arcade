// packages/shell/src/screens/settings/language/language-change.ts (stand-in: settings-and-preferences ships the real file)
// S11a's "System (…)" row takes its label from the real file's systemLabel, so the copy key is here.
export function systemLabel(t: (key: string, values: object) => string, languageName: string): string {
  return t('settings.language.system', { languageName });
}
