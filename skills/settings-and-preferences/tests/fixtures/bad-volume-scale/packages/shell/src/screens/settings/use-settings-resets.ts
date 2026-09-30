// packages/shell/src/screens/settings/use-settings-resets.ts
// The reset handlers the S14 reset dialogs call, bound to the app's save and stores.
import { useServices } from '@e07/shell/app/services-context.tsx';
import { useStores } from '@e07/shell/app/stores-context.tsx';

import { createSettingsResets } from './settings-resets.ts';

import type { SettingsResets } from './settings-resets.ts';

export function useSettingsResets(): SettingsResets {
  const { save } = useServices();
  const stores = useStores();
  return createSettingsResets({ save, stores });
}
