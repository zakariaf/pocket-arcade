// apps/flock-tilt/src/sounds/sound-bank.ts
import type { SoundBank } from '@e07/shell/services/audio/audio-port.ts';

/**
 * Flock Tilt's four sounds, exactly the ids its buildTimeline cues: tilt (the field tips and the
 * animals slide), bump (the first animal stops against something), pen (a sheep drops into the
 * pen) and bleat (the wolf got a sheep). A won or lost field sounds through the Shell's ui.win and
 * ui.lose (the game host's result step), and the continue plays no board sound. The Shell adds its
 * own ui.* sounds (composeSoundBank).
 */
export const SOUND_BANK: SoundBank = {
  /** The most repeated sound, so the quietest: a soft airy slide with a low falling hum. */
  tilt: {
    category: 'sfx',
    recipe: [
      {
        wave: 'noise',
        startHz: 0,
        endHz: 0,
        offsetMs: 0,
        durationMs: 140,
        attackMs: 30,
        gain: 0.14,
        seed: 11,
      },
      {
        wave: 'sine',
        startHz: 300,
        endHz: 210,
        offsetMs: 0,
        durationMs: 130,
        attackMs: 12,
        gain: 0.2,
      },
    ],
  },
  /** A soft wooden knock where the slide stops: a short falling sine. */
  bump: {
    category: 'sfx',
    minIntervalMs: 60,
    recipe: [
      {
        wave: 'sine',
        startHz: 240,
        endHz: 150,
        offsetMs: 0,
        durationMs: 70,
        attackMs: 1,
        gain: 0.32,
      },
    ],
  },
  /** A happy plop: a rising triangle with a bright blip 50 ms later. */
  pen: {
    category: 'sfx',
    recipe: [
      {
        wave: 'triangle',
        startHz: 440,
        endHz: 700,
        offsetMs: 0,
        durationMs: 90,
        attackMs: 2,
        gain: 0.42,
      },
      {
        wave: 'sine',
        startHz: 1050,
        endHz: 1050,
        offsetMs: 50,
        durationMs: 120,
        attackMs: 2,
        gain: 0.26,
      },
    ],
  },
  /** The warning: a short nasal "baa", a square falling a little over a soft triangle. */
  bleat: {
    category: 'sfx',
    recipe: [
      {
        wave: 'square',
        startHz: 520,
        endHz: 430,
        offsetMs: 0,
        durationMs: 260,
        attackMs: 8,
        gain: 0.28,
      },
      {
        wave: 'triangle',
        startHz: 780,
        endHz: 650,
        offsetMs: 0,
        durationMs: 240,
        attackMs: 8,
        gain: 0.16,
      },
    ],
  },
};
