// packages/shell/src/app/localized-root.tsx
// The effect of the Language and Numbers rows: the I18nProvider reads both from the settings
// store, so a change re-renders every translated string and number at once (no restart,
// except a direction flip, which the language screen handles with the restart dialog).
import { I18nProvider } from '@e07/shell/i18n/i18n-provider.tsx';
import { resolveLanguage } from '@e07/shell/i18n/resolve-language.ts';
import { selectDigits, selectLanguage } from '@e07/shell/stores/settings-selectors.ts';
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

import type { Language } from '@e07/shell/i18n/languages.ts';
import type { Catalog } from '@e07/shell/i18n/messages.ts';
import type { DeviceLocale } from '@e07/shell/i18n/resolve-language.ts';
import type { ReactNode } from 'react';

export type LocalizedRootProps = {
  /** expo-localization getLocales(), read once at startup (System resolves against it). */
  readonly deviceLocales: readonly DeviceLocale[];
  readonly gameCatalogs: Readonly<Record<Language, Catalog>>;
  readonly onError: (error: Error) => void;
  readonly children: ReactNode;
};

export function LocalizedRoot(props: LocalizedRootProps): ReactNode {
  const { deviceLocales, gameCatalogs, onError, children } = props;
  const saved = useSettingsStore(selectLanguage);
  const digits = useSettingsStore(selectDigits);
  const language = resolveLanguage(saved, deviceLocales);
  return (
    <I18nProvider language={language} digits={digits} gameCatalogs={gameCatalogs} onError={onError}>
      {children}
    </I18nProvider>
  );
}
