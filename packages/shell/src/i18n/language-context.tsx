// packages/shell/src/i18n/language-context.tsx
import { createContext, use } from 'react';

import type { Language } from './languages.ts';

export const LanguageContext = createContext<Language>('en');

export function useLanguage(): Language {
  return use(LanguageContext);
}
