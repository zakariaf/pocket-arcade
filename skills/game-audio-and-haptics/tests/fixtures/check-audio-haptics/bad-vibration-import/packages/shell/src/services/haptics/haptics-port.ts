// packages/shell/src/services/haptics/haptics-port.ts
import type { HapticCue } from '@e07/game-kit/timeline/track.ts';

export type { HapticCue };

/** The ONLY haptics API the Shell and games use. Adapter: expo-haptics-adapter.ts. */
export type HapticsPort = {
  /** False on devices without a Taptic Engine: Settings hides the Vibration row. */
  readonly isSupported: boolean;
  /** Fire-and-forget. Gated by the Vibration setting and throttled; never throws. */
  readonly play: (cue: HapticCue) => void;
};
