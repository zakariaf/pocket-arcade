// packages/shell/src/screens/game/game-audio.ts
import { useAudioLifecycle } from '@e07/shell/services/audio/use-audio-lifecycle.ts';

import type { AudioPort } from '@e07/shell/services/audio/audio-port.ts';

export function useGameAudio(audio: AudioPort): void {
  useAudioLifecycle({ audio, isFullscreenAdShowing: false, reportError: () => undefined });
}
