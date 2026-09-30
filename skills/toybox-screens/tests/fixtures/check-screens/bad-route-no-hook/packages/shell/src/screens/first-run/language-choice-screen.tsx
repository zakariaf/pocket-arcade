// packages/shell/src/screens/first-run/language-choice-screen.tsx (planted: the route builds its model inline)
import { useSettingsStore } from '@e07/shell/stores/settings-store.ts';

import { LanguageChoiceView } from './language-choice-view.tsx';

import type { ReactNode } from 'react';

export function LanguageChoiceScreen(): ReactNode {
  const dispatch = useSettingsStore((state) => state.dispatch);
  return <LanguageChoiceView model={{ selected: 'en', onContinue: () => dispatch({ type: 'finish-tutorial' }) }} />;
}
