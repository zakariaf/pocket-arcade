// packages/shell/src/app/language-change.ts
import { restartForDirection } from '@e07/shell/i18n/direction.ts';

import type { AudioPort } from '@e07/shell/services/audio/audio-port.ts';

/** Restart now: close the native audio engine, then reload in the new direction. */
export async function restartNow(audio: AudioPort, isRtl: boolean): Promise<void> {
  await audio.dispose();
  await restartForDirection(isRtl);
}
