// packages/shell/src/stores/create-shell-stores.ts
import { createPremiumStore } from '@e07/shell/stores/premium/premium-store.ts';
import { createProgressStore } from '@e07/shell/stores/progress-store.ts';
import { createSettingsStore } from '@e07/shell/stores/settings-store.ts';
import { createStatsStore } from '@e07/shell/stores/stats-store.ts';

import type { ShellStores } from '@e07/shell/app/stores-context.tsx';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';

/**
 * Every domain store from the loaded save, once per app start. createShellApp calls it after
 * hydrateSave; renderWithShell calls it over an in-memory save, so tests use the real factories.
 */
export function createShellStores(save: SaveService): ShellStores {
  return {
    settings: createSettingsStore(save),
    progress: createProgressStore(save),
    stats: createStatsStore(save),
    premium: createPremiumStore(save),
  };
}
