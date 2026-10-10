// packages/shell/src/screens/settings/settings-screen.tsx
// device-only: covered by the settings e2e flows and the S11 parity captures; a route file only joins its model hook and its view, which have their own tests.
import { SettingsView } from './settings-view.tsx';
import { useSettingsContext } from './use-settings-context.ts';
import { useSettingsExtras } from './use-settings-extras.ts';
import { useSettingsModel } from './use-settings-model.ts';

import type { ReactNode } from 'react';

/** Route Settings (S11): the settings model (values, rows, handlers) plus navigation extras. */
export function SettingsScreen(): ReactNode {
  const model = useSettingsModel(useSettingsContext());
  const extras = useSettingsExtras();
  return <SettingsView model={model} extras={extras} />;
}
