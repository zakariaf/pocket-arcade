// packages/shell/src/services/audio/fake-audio.ts
import type { AudioPort, AudioSettings, SoundBank } from './audio-port.ts';

export type AudioCall =
  | { readonly kind: 'play'; readonly soundId: string; readonly delayMs: number }
  | { readonly kind: 'cancel-pending' }
  | { readonly kind: 'settings'; readonly settings: AudioSettings }
  | { readonly kind: 'music'; readonly soundId: string | null }
  | { readonly kind: 'suspend' | 'resume' | 'dispose' };

/** In-memory AudioPort for Jest and offline test builds: records every call. */
export function createFakeAudio(): AudioPort & {
  readonly calls: AudioCall[];
  readonly loadedIds: string[];
} {
  const calls: AudioCall[] = [];
  const loadedIds: string[] = [];
  return {
    calls,
    loadedIds,
    load: (bank: SoundBank) => loadedIds.push(...Object.keys(bank)),
    play: (soundId, delayMs = 0) => calls.push({ kind: 'play', soundId, delayMs }),
    cancelPending: () => calls.push({ kind: 'cancel-pending' }),
    applySettings: (settings) => calls.push({ kind: 'settings', settings }),
    startMusic: (soundId) => calls.push({ kind: 'music', soundId }),
    stopMusic: () => calls.push({ kind: 'music', soundId: null }),
    suspend: () => {
      calls.push({ kind: 'suspend' });
      return Promise.resolve();
    },
    resume: () => {
      calls.push({ kind: 'resume' });
      return Promise.resolve();
    },
    dispose: () => {
      calls.push({ kind: 'dispose' });
      return Promise.resolve();
    },
  };
}
