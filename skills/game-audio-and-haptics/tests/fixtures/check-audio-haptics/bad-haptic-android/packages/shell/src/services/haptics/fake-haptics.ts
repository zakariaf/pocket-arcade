// packages/shell/src/services/haptics/fake-haptics.ts
import type { HapticCue, HapticsPort } from './haptics-port.ts';

export function createFakeHaptics(
  isSupported = true,
): HapticsPort & { readonly played: HapticCue[] } {
  const played: HapticCue[] = [];
  return { isSupported, played, play: (cue) => played.push(cue) };
}
