// packages/shell/src/screens/settings/settings-resets.ts
// The two S11 data resets, run when their S14 dialog is confirmed. Each is ONE validated write
// through updateAndPublish with the backup refreshed (a backup restore can never undo a reset),
// after which every section store re-reads the document, so Home, Levels, Daily and Statistics
// show the reset at once. Settings, first-run state, ads consent and Premium are never touched.
import { resetAllProgress, resetStatistics } from '@e07/shell/services/save/reset-progress.ts';
import { updateAndPublish } from '@e07/shell/stores/update-and-publish.ts';

import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { SectionStores } from '@e07/shell/stores/update-and-publish.ts';

export type SettingsResetDeps = {
  readonly save: SaveService;
  readonly stores: SectionStores;
};

export type SettingsResets = {
  /** "Reset statistics" confirmed (danger block button in dialog.reset-stats). */
  readonly onConfirmResetStats: () => void;
  /** "Reset all progress" held for 2 s (hold button in dialog.reset-progress). */
  readonly onConfirmResetProgress: () => void;
};

export function createSettingsResets({ save, stores }: SettingsResetDeps): SettingsResets {
  return {
    onConfirmResetStats: () => {
      updateAndPublish(save, stores, { recipe: resetStatistics, refreshBackup: true });
    },
    onConfirmResetProgress: () => {
      save.update(resetAllProgress, { refreshBackup: true });
    },
  };
}
