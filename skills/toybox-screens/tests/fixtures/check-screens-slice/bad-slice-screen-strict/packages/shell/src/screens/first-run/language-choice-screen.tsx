// packages/shell/src/screens/first-run/language-choice-screen.tsx
import { LanguageChoiceView } from './language-choice-view.tsx';
import { useLanguageChoiceModel } from './use-language-choice-model.ts';

import type { ReactNode } from 'react';

/** Route LanguageChoice (S2). The model hook reads the stores; the view only draws. */
export function LanguageChoiceScreen(): ReactNode {
  const model = useLanguageChoiceModel();
  return <LanguageChoiceView model={model} />;
}
