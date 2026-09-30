// apps/demo-game/src/board/on-events.ts
import type { AudioPort } from '@e07/shell/services/audio/audio-port.ts';
import type { HapticsPort } from '@e07/shell/services/haptics/haptics-port.ts';

/** Drained sim events to sounds and haptics, once per frame on JS (never per tick). */
export function onHit(audio: AudioPort, haptics: HapticsPort): void {
  audio.play('flip');
  haptics.play('heavy');
}
