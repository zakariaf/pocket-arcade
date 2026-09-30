// packages/shell/src/services/haptics/haptics-port.ts
// Fixture stand-in for the haptics port (game-audio-and-haptics ships the real one).
export type HapticCue = 'selection' | 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';
export type HapticsPort = { readonly isSupported: boolean; readonly play: (cue: HapticCue) => void };
