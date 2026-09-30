// packages/shell/src/services/audio/audio-port.ts
import type { SoundRecipe } from '@e07/shell/services/audio/synth/synthesize-recipe.ts';

export type SoundCategory = 'sfx' | 'ui' | 'music';

export type SoundSpec = {
  readonly category: SoundCategory;
  readonly recipe: SoundRecipe;
  /** Same sound cannot restart sooner than this (default 30 ms). */
  readonly minIntervalMs?: number;
  /** Music only: loop the buffer. */
  readonly isLoop?: boolean;
};

export type SoundBank = Readonly<Record<string, SoundSpec>>;

export type ChannelSetting = { readonly isOn: boolean; readonly volume: number };

/** From the settings store. Music defaults to OFF: never play over the player's own music. */
export type AudioSettings = { readonly effects: ChannelSetting; readonly music: ChannelSetting };

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  effects: { isOn: true, volume: 0.8 },
  music: { isOn: false, volume: 0.6 },
};

/** The ONLY audio API the Shell and games use. Adapter: audio-api-audio-adapter.ts. */
export type AudioPort = {
  /** Synthesises and uploads every buffer of the bank (call once at startup). */
  readonly load: (bank: SoundBank) => void;
  /** Plays a sound now or after `delayMs` (timeline cues). Silently ignores unknown ids. */
  readonly play: (soundId: string, delayMs?: number) => void;
  /** Stops sounds scheduled for the future (timeline fast-forward, pause). */
  readonly cancelPending: () => void;
  readonly applySettings: (settings: AudioSettings) => void;
  readonly startMusic: (soundId: string) => void;
  readonly stopMusic: () => void;
  readonly suspend: () => Promise<void>;
  readonly resume: () => Promise<void>;
  /** Before reloadAppAsync (direction change) and in tests. */
  readonly dispose: () => Promise<void>;
};
