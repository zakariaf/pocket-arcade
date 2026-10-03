// packages/shell/src/game-host/cue-scheduler.ts
import type { Track } from '@e07/game-kit/timeline/track.ts';
import type { AudioPort } from '@e07/shell/services/audio/audio-port.ts';
import type { HapticsPort } from '@e07/shell/services/haptics/haptics-port.ts';

export type CueScheduler = {
  /**
   * Fires every track cue at the track's start: sounds on the audio clock, haptics via timers. Until
   * the lifecycle first says the board may run, and while it may not, the cues are held, as the
   * clock holds the scene, and play on resume (a board mounted under an ad plays them once).
   */
  readonly schedule: (tracks: readonly Track[]) => void;
  /** Drops everything not yet fired (fast-forward, leaving the screen); nothing is held. */
  readonly cancel: () => void;
  /** The board may not run (an ad, the background, blur): drops everything not yet fired. */
  readonly pause: () => void;
  /** The board may run: held cues play now, as the clock starts their scene. */
  readonly resume: () => void;
};

/** The latest scheduled scene's cues, and whether they played (false: held until resume). */
type Latest = { readonly tracks: readonly Track[]; readonly isPlayed: boolean };

type Ports = { readonly audio: AudioPort; readonly haptics: HapticsPort };

/** Plays the cues of `tracks` and returns the haptic timers it started. */
function fireCues(ports: Ports, tracks: readonly Track[]): ReturnType<typeof setTimeout>[] {
  const timers: ReturnType<typeof setTimeout>[] = [];
  for (const { cue, startMs } of tracks) {
    if (cue?.sound !== undefined) ports.audio.play(cue.sound, startMs);
    const haptic = cue?.haptic;
    if (haptic === undefined) continue;
    if (startMs <= 0) ports.haptics.play(haptic);
    else
      timers.push(
        setTimeout(() => {
          ports.haptics.play(haptic);
        }, startMs),
      );
  }
  return timers;
}

export function createCueScheduler(audio: AudioPort, haptics: HapticsPort): CueScheduler {
  let timers: ReturnType<typeof setTimeout>[] = [];
  // False until the lifecycle's first resume: the mount scene is pushed before that decision.
  let isRunning = false;
  let latest: Latest | null = null;
  const play = (tracks: readonly Track[]): void => {
    timers = [...timers, ...fireCues({ audio, haptics }, tracks)];
  };
  const drop = (): void => {
    for (const timer of timers) clearTimeout(timer);
    timers = [];
    audio.cancelPending();
  };
  return {
    schedule: (tracks) => {
      latest = { tracks, isPlayed: isRunning };
      if (isRunning) play(tracks);
    },
    cancel: () => {
      drop();
      latest = null;
    },
    pause: () => {
      isRunning = false;
      drop();
    },
    resume: () => {
      isRunning = true;
      if (latest === null || latest.isPlayed) return;
      play(latest.tracks);
      latest = { ...latest, isPlayed: true };
    },
  };
}
