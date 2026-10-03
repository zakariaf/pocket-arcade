// packages/shell/src/game-host/cue-scheduler.ts
import type { Track } from '@e07/game-kit/timeline/track.ts';
import type { AudioPort } from '@e07/shell/services/audio/audio-port.ts';
import type { HapticsPort } from '@e07/shell/services/haptics/haptics-port.ts';

export type CueScheduler = {
  /** Fires every track cue at the track's start: sounds on the audio clock, haptics via timers. */
  readonly schedule: (tracks: readonly Track[]) => void;
  /** Drops everything not yet fired (fast-forward, pause, leaving the screen). */
  readonly cancel: () => void;
};

export function createCueScheduler(audio: AudioPort, haptics: HapticsPort): CueScheduler {
  let timers: ReturnType<typeof setTimeout>[] = [];
  const cancel = (): void => {
    for (const timer of timers) clearTimeout(timer);
    timers = [];
    audio.cancelPending();
  };
  const schedule = (tracks: readonly Track[]): void => {
    for (const { cue, startMs } of tracks) {
      if (cue?.sound !== undefined) audio.play(cue.sound, startMs);
      const haptic = cue?.haptic;
      if (haptic === undefined) continue;
      if (startMs <= 0) haptics.play(haptic);
      else
        timers.push(
          setTimeout(() => {
            haptics.play(haptic);
          }, startMs),
        );
    }
  };
  return { schedule, cancel };
}
