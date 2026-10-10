// packages/shell/src/i18n/create-language-t.ts
// S2 previews a language before it is saved: "Continue" reads in the language being chosen,
// while the rest of the screen stays in the current one. This builds that one t() from the
// Shell catalogs (S2 shows no game text), with the same digits and bidi rules as the app's t().
import { createIntl, createIntlCache } from 'react-intl';

import { createT } from './create-t.ts';
import { intlConfigOf } from './messages.ts';

import type { TFunction } from './create-t.ts';
import type { DigitStyle } from './digits.ts';
import type { Language } from './languages.ts';
import type { Catalog } from './messages.ts';

const NO_GAME: Readonly<Record<Language, Catalog>> = { en: {}, de: {}, fa: {}, ckb: {} };
const CACHE = createIntlCache();

export function createLanguageT(
  language: Language,
  digits: DigitStyle,
  onError: (error: Error) => void,
): TFunction {
  const intl = createIntl(
    intlConfigOf({ language, digits, gameCatalogs: NO_GAME, onError }),
    CACHE,
  );
  return createT({ intl, onError });
}
