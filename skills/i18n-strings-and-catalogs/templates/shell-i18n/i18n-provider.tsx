// packages/shell/src/i18n/i18n-provider.tsx
import { IntlProvider } from 'react-intl';

import { LanguageContext } from './language-context.tsx';
import { intlConfigOf } from './messages.ts';
import { TBridge } from './t-bridge.tsx';

import type { DigitStyle } from './digits.ts';
import type { Language } from './languages.ts';
import type { Catalog } from './messages.ts';
import type { ReactNode } from 'react';

export type I18nProviderProps = {
  readonly language: Language;
  readonly digits: DigitStyle;
  readonly gameCatalogs: Readonly<Record<Language, Catalog>>;
  readonly onError: (error: Error) => void; // ErrorLogPort in the app, `throw` in tests
  readonly children: ReactNode;
};

export function I18nProvider(props: I18nProviderProps): ReactNode {
  const { language, digits, gameCatalogs, onError, children } = props;
  return (
    <IntlProvider {...intlConfigOf({ language, digits, gameCatalogs, onError })}>
      <LanguageContext value={language}>
        <TBridge onError={onError}>{children}</TBridge>
      </LanguageContext>
    </IntlProvider>
  );
}
