// packages/shell/src/game-host/cue-scheduler.test.ts
import { createCueScheduler } from './cue-scheduler.ts';

import type { Track } from '@e07/game-kit/timeline/track.ts';
import type { AudioPort } from '@e07/shell/services/audio/audio-port.ts';
import type { HapticCue, HapticsPort } from '@e07/shell/services/haptics/haptics-port.ts';

type AudioCall =
  | { readonly kind: 'play'; readonly soundId: string; readonly delayMs: number }
  | { readonly kind: 'cancel-pending' };

/** Records what the scheduler asks of the ports; only play and cancelPending matter here. */
function fakePorts(): {
  audio: AudioPort;
  haptics: HapticsPort;
  calls: AudioCall[];
  played: HapticCue[];
} {
  const calls: AudioCall[] = [];
  const played: HapticCue[] = [];
  const audio = {
    play: (soundId: string, delayMs = 0) => calls.push({ kind: 'play', soundId, delayMs }),
    cancelPending: () => calls.push({ kind: 'cancel-pending' }),
  } as unknown as AudioPort;
  const haptics: HapticsPort = { isSupported: true, play: (cue) => played.push(cue) };
  return { audio, haptics, calls, played };
}

const cued = (startMs: number): Track => ({
  channel: 'beam',
  entityId: 1,
  startMs,
  durationMs: 100,
  easing: 'linear',
  from: [0],
  to: [1],
  cue: { sound: 'beam', haptic: 'medium' },
});

describe('cue scheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  it('schedules sounds on the audio clock and haptics at the track start', () => {
    const ports = fakePorts();
    const cues = createCueScheduler(ports.audio, ports.haptics);
    cues.resume();
    cues.schedule([cued(0), cued(120)]);
    expect(ports.calls).toStrictEqual([
      { kind: 'play', soundId: 'beam', delayMs: 0 },
      { kind: 'play', soundId: 'beam', delayMs: 120 },
    ]);
    expect(ports.played).toStrictEqual(['medium']);
    jest.advanceTimersByTime(120);
    expect(ports.played).toStrictEqual(['medium', 'medium']);
  });

  it('drops pending cues on cancel (fast-forward, pause, leaving the screen)', () => {
    const ports = fakePorts();
    const cues = createCueScheduler(ports.audio, ports.haptics);
    cues.resume();
    cues.schedule([cued(200)]);
    cues.cancel();
    jest.advanceTimersByTime(500);
    expect(ports.played).toStrictEqual([]);
    expect(ports.calls.at(-1)).toStrictEqual({ kind: 'cancel-pending' });
  });

  it('holds the cues of a scene scheduled while the board may not run, and plays them on resume', () => {
    const ports = fakePorts();
    const cues = createCueScheduler(ports.audio, ports.haptics);
    cues.resume();
    cues.pause();
    cues.schedule([cued(0), cued(120)]);
    expect(ports.calls).toStrictEqual([{ kind: 'cancel-pending' }]);
    expect(ports.played).toStrictEqual([]);
    cues.resume();
    expect(ports.calls.slice(1)).toStrictEqual([
      { kind: 'play', soundId: 'beam', delayMs: 0 },
      { kind: 'play', soundId: 'beam', delayMs: 120 },
    ]);
    jest.advanceTimersByTime(120);
    expect(ports.played).toStrictEqual(['medium', 'medium']);
  });

  it('holds the cues of a scene scheduled before the lifecycle decides, and plays them once on the first resume', () => {
    const ports = fakePorts();
    const cues = createCueScheduler(ports.audio, ports.haptics);
    // Mounted under a full-screen ad: the clock holds the mount scene until the first resume.
    cues.schedule([cued(0)]);
    cues.pause();
    expect(ports.calls).toStrictEqual([{ kind: 'cancel-pending' }]);
    expect(ports.played).toStrictEqual([]);
    cues.resume();
    expect(ports.calls.slice(1)).toStrictEqual([{ kind: 'play', soundId: 'beam', delayMs: 0 }]);
    expect(ports.played).toStrictEqual(['medium']);
  });

  it('replays neither the cues of a scene that had started nor those of a cancelled one', () => {
    const ports = fakePorts();
    const cues = createCueScheduler(ports.audio, ports.haptics);
    cues.resume();
    cues.schedule([cued(0)]);
    cues.pause();
    cues.resume();
    cues.pause();
    cues.schedule([cued(0)]);
    cues.cancel();
    cues.resume();
    expect(ports.calls.filter((call) => call.kind === 'play')).toHaveLength(1);
  });
});
