// packages/shell/src/stores/update-and-publish.ts
import { progressSliceOf } from '@e07/shell/stores/progress-store.ts';
import { statsSliceOf } from '@e07/shell/stores/stats-store.ts';

import type { ShellStores } from '@e07/shell/app/stores-context.tsx';
import type { SaveService } from '@e07/shell/services/save/save-service.ts';
import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

/** The stores whose state is a plain copy of save sections. */
export type SectionStores = Pick<ShellStores, 'settings' | 'progress' | 'stats'>;

export type SectionWrite = {
  /** Pure: the whole next document (compose the pure section functions here). */
  readonly recipe: (doc: SaveDoc) => SaveDoc;
  /** true for a run end, a reset or an import: the backup slot is refreshed too. */
  readonly refreshBackup: boolean;
};

/**
 * One validated write that spans several sections (run end, "Reset all progress"), then every
 * section store re-reads its sections from the saved document: persist first, publish second.
 */
export function updateAndPublish(
  save: SaveService,
  stores: SectionStores,
  write: SectionWrite,
): void {
  save.update(write.recipe, { refreshBackup: write.refreshBackup });
  const doc = save.doc();
  stores.settings.setState({ settings: doc.settings, firstRun: doc.firstRun });
  stores.progress.setState(progressSliceOf(doc));
  stores.stats.setState(statsSliceOf(doc));
}
