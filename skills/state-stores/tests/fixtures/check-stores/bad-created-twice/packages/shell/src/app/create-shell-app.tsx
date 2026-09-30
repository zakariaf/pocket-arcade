import { createPremiumStore } from '@e07/shell/stores/premium/premium-store.ts';
import { createSettingsStore } from '@e07/shell/stores/settings-store.ts';

import type { SaveService } from '@e07/shell/services/save/save-service.ts';

export function buildStores(save: SaveService): unknown {
  return { settings: createSettingsStore(save), premium: createPremiumStore(save) };
}
