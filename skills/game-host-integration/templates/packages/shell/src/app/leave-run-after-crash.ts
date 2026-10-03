// packages/shell/src/app/leave-run-after-crash.ts
import type { SaveService } from '@e07/shell/services/save/save-service.ts';

/**
 * The crash screen's "Back to Home" (spec 8.14, never a crash loop): like Pause -> Home, the run
 * stays saved for Home's Continue, but resumeOnLaunch turns false, so a relaunch lands on Home
 * instead of reopening the run that crashed. A save without a run is kept.
 */
export function leaveRunAfterCrash(save: SaveService): void {
  const { run } = save.doc();
  if (run === null) return;
  save.update((doc) => ({ ...doc, run: { ...run, resumeOnLaunch: false } }));
}
