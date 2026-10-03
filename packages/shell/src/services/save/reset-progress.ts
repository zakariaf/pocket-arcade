// packages/shell/src/services/save/reset-progress.ts
import { createDefaultSaveDoc } from '@e07/shell/services/save/schema/default-save-doc.ts';

import type { SaveDoc } from '@e07/shell/services/save/schema/save-doc.ts';

/**
 * S11 "Reset all progress": levels, stars, run, daily, statistics, hints, upsell.
 * KEPT: settings (incl. language), firstRun, ads consent/caps, and premium (never reset).
 */
export function resetAllProgress(doc: SaveDoc): SaveDoc {
  const fresh = createDefaultSaveDoc(doc.gameId);
  return {
    ...doc,
    progress: fresh.progress,
    run: fresh.run,
    daily: fresh.daily,
    stats: fresh.stats,
    hints: fresh.hints,
    upsell: fresh.upsell,
  };
}

/** S10/S11 "Reset statistics": the stats section only. */
export function resetStatistics(doc: SaveDoc): SaveDoc {
  return { ...doc, stats: createDefaultSaveDoc(doc.gameId).stats };
}
