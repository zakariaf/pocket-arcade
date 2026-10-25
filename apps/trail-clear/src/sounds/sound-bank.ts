// apps/trail-clear/src/sounds/sound-bank.ts
import type { SoundBank } from '@e07/shell/services/audio/audio-port.ts';

/**
 * Trail Clear's four sounds, exactly the ids its buildTimeline cues: place (a tile set down),
 * loop (a road or a river closed), double (one tile closed both at once) and wipe (the closed
 * loop's tiles cleared). Winning and losing play the Shell's ui.win and ui.lose; the haptic cues
 * ride on the timeline (place light, loop success, double heavy). The Shell adds its own ui.*
 * sounds (composeSoundBank).
 */
export const SOUND_BANK: SoundBank = {
  /** The most repeated sound, so the quietest: a soft wooden tap, a triangle falling a little. */
  place: {
    category: 'sfx',
    recipe: [
      {
        wave: 'triangle',
        startHz: 330,
        endHz: 260,
        offsetMs: 0,
        durationMs: 70,
        attackMs: 2,
        gain: 0.22,
      },
    ],
  },
  /** A loop closed: a bright rising fifth (G then D an octave up). */
  loop: {
    category: 'sfx',
    recipe: [
      {
        wave: 'triangle',
        startHz: 392,
        endHz: 392,
        offsetMs: 0,
        durationMs: 120,
        attackMs: 3,
        gain: 0.38,
      },
      {
        wave: 'triangle',
        startHz: 587,
        endHz: 587,
        offsetMs: 80,
        durationMs: 200,
        attackMs: 3,
        gain: 0.38,
      },
    ],
  },
  /** Both at once: a rising major arpeggio with a high sparkle on top. */
  double: {
    category: 'sfx',
    recipe: [
      {
        wave: 'triangle',
        startHz: 523,
        endHz: 523,
        offsetMs: 0,
        durationMs: 110,
        attackMs: 3,
        gain: 0.35,
      },
      {
        wave: 'triangle',
        startHz: 659,
        endHz: 659,
        offsetMs: 70,
        durationMs: 110,
        attackMs: 3,
        gain: 0.35,
      },
      {
        wave: 'triangle',
        startHz: 784,
        endHz: 784,
        offsetMs: 140,
        durationMs: 160,
        attackMs: 3,
        gain: 0.35,
      },
      {
        wave: 'sine',
        startHz: 1568,
        endHz: 1568,
        offsetMs: 210,
        durationMs: 220,
        attackMs: 4,
        gain: 0.2,
      },
    ],
  },
  /** The tiles cleared: a soft brush of noise over a falling sine. */
  wipe: {
    category: 'sfx',
    recipe: [
      {
        wave: 'noise',
        startHz: 0,
        endHz: 0,
        offsetMs: 0,
        durationMs: 180,
        attackMs: 20,
        gain: 0.16,
        seed: 11,
      },
      {
        wave: 'sine',
        startHz: 520,
        endHz: 260,
        offsetMs: 0,
        durationMs: 200,
        attackMs: 5,
        gain: 0.3,
      },
    ],
  },
};
