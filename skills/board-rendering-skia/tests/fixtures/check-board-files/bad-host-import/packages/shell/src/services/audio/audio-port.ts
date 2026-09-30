// packages/shell/src/services/audio/audio-port.ts
// Fixture stand-in for the audio port (game-audio-and-haptics ships the real one).
export type AudioPort = {
  readonly play: (soundId: string, delayMs?: number) => void;
  readonly cancelPending: () => void;
  readonly suspend: () => Promise<void>;
  readonly resume: () => Promise<void>;
};
