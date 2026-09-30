// packages/shell/src/app/start-shell.ts
import { restartForDirection } from '@e07/shell/i18n/direction.ts';

/** Startup direction check: runs before the composition root creates audio, so nothing to dispose. */
export function startShell(needsRestart: boolean, isRtl: boolean): void {
  if (needsRestart) restartForDirection(isRtl).catch(() => undefined);
}
