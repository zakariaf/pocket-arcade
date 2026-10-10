// packages/shell/src/app/restart-after-audio.ts
// The one sequence for a direction reload after the Shell has started (S2 Continue, the S14
// "Restart to apply", the test-only debug link's lang=): the audio engine is disposed first, so
// the native engine closes before the JS reload, then restartForDirection writes the guard,
// forces the direction and reloads. A dispose that fails is reported and the reload still runs:
// the save already holds the new language, and skipping the reload would leave the layout in the
// old direction until the next cold start. The boot's restart (start-shell.ts) runs before any
// audio exists and calls restartForDirection itself.
import { restartForDirection } from '@e07/shell/i18n/direction.ts';

import type { DirectionGuard } from '@e07/shell/i18n/direction-guard.ts';
import type { Direction } from '@e07/shell/i18n/languages.ts';
import type { AudioPort } from '@e07/shell/services/audio/audio-port.ts';

export type RestartParts = {
  readonly audio: Pick<AudioPort, 'dispose'>;
  readonly guard: DirectionGuard;
  /** A failed dispose lands here (the error log); the reload still runs. */
  readonly onDisposeError: (error: unknown) => void;
};

export async function restartAfterAudio(parts: RestartParts, direction: Direction): Promise<void> {
  try {
    await parts.audio.dispose();
  } catch (error: unknown) {
    parts.onDisposeError(error);
  }
  await restartForDirection(direction, parts.guard);
}
