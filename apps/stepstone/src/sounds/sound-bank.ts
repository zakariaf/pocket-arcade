// apps/stepstone/src/sounds/sound-bank.ts
import type { SoundBank } from '@e07/shell/services/audio/audio-port.ts';

/**
 * Stepstone's sound set (spec 8.7: synthesised, no music). Each id is named by a
 * `cue: { sound: '<id>' }` in buildTimeline; the Shell loads its own ui.* sounds beside it.
 */
export const SOUND_BANK: SoundBank = {
  /** The frog hops: a short sine that springs up an octave. The most repeated, so the quietest. */
  hop: {
    category: 'sfx',
    recipe: [
      {
        wave: 'sine',
        startHz: 330,
        endHz: 660,
        offsetMs: 0,
        durationMs: 90,
        attackMs: 3,
        gain: 0.3,
      },
    ],
  },
  /** The stone left behind sinks: a low falling sine with a little soft noise, a plop. */
  sink: {
    category: 'sfx',
    recipe: [
      {
        wave: 'sine',
        startHz: 220,
        endHz: 110,
        offsetMs: 0,
        durationMs: 160,
        attackMs: 4,
        gain: 0.35,
      },
      {
        wave: 'noise',
        startHz: 0,
        endHz: 0,
        offsetMs: 0,
        durationMs: 90,
        attackMs: 4,
        gain: 0.08,
        seed: 5,
      },
    ],
  },
  /** The frog takes a new hop kind: two bright triangle notes (G5, then C6). */
  'kind-change': {
    category: 'sfx',
    recipe: [
      {
        wave: 'triangle',
        startHz: 783.99,
        endHz: 783.99,
        offsetMs: 0,
        durationMs: 80,
        attackMs: 2,
        gain: 0.35,
      },
      {
        wave: 'triangle',
        startHz: 1046.5,
        endHz: 1046.5,
        offsetMs: 70,
        durationMs: 120,
        attackMs: 2,
        gain: 0.35,
      },
    ],
  },
  /** The flag: a rising major arpeggio (C5, E5, G5, C6). */
  win: {
    category: 'sfx',
    recipe: [
      {
        wave: 'triangle',
        startHz: 523.25,
        endHz: 523.25,
        offsetMs: 0,
        durationMs: 120,
        attackMs: 3,
        gain: 0.4,
      },
      {
        wave: 'triangle',
        startHz: 659.25,
        endHz: 659.25,
        offsetMs: 100,
        durationMs: 120,
        attackMs: 3,
        gain: 0.4,
      },
      {
        wave: 'triangle',
        startHz: 783.99,
        endHz: 783.99,
        offsetMs: 200,
        durationMs: 120,
        attackMs: 3,
        gain: 0.4,
      },
      {
        wave: 'sine',
        startHz: 1046.5,
        endHz: 1046.5,
        offsetMs: 300,
        durationMs: 260,
        attackMs: 4,
        gain: 0.45,
      },
    ],
  },
  /** No stone in reach: two soft falling notes. */
  stuck: {
    category: 'sfx',
    recipe: [
      {
        wave: 'sine',
        startHz: 392,
        endHz: 370,
        offsetMs: 0,
        durationMs: 160,
        attackMs: 4,
        gain: 0.4,
      },
      {
        wave: 'sine',
        startHz: 330,
        endHz: 294,
        offsetMs: 150,
        durationMs: 260,
        attackMs: 4,
        gain: 0.4,
      },
    ],
  },
};
