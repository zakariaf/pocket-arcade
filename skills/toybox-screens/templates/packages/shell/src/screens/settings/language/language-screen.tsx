// packages/shell/src/screens/settings/language/language-screen.tsx
// device-only: covered by the RTL language-switch e2e flow; a route file only joins its model hook and its view, which have their own tests.
import { SettingsLanguageView } from './language-view.tsx';
import { useSettingsLanguageModel } from './use-settings-language-model.ts';

import type { ReactNode } from 'react';

/** Route SettingsLanguage (S11a). */
export function SettingsLanguageScreen(): ReactNode {
  const model = useSettingsLanguageModel();
  return <SettingsLanguageView model={model} />;
}
