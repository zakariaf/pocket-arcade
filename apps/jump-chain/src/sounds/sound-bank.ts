// apps/jump-chain/src/sounds/sound-bank.ts
import type { SoundBank } from '@e07/shell/services/audio/audio-port.ts';

/**
 * Jump Chain's five sounds, exactly the ids its buildTimeline cues: step (the piece slides one
 * square), capture (each jumped enemy pops), clear (a rank is cleared), march (the ranks advance,
 * or step back for the continue) and overrun (an enemy reaches your side). Winning and losing play
 * the Shell's ui.win and ui.lose. The Shell adds its own ui.* sounds (composeSoundBank).
 */
export const SOUND_BANK: SoundBank = {
  /** The most repeated sound, so the quietest: a soft triangle tap falling a little. */
  step: {
    category: 'sfx',
    recipe: [
      {
        wave: 'triangle',
        startHz: 440,
        endHz: 360,
        offsetMs: 0,
        durationMs: 60,
        attackMs: 2,
        gain: 0.2,
      },
    ],
  },
  /** A bright pop for each jumped enemy: a rising triangle with a higher blip after it. */
  capture: {
    category: 'sfx',
    recipe: [
      {
        wave: 'triangle',
        startHz: 620,
        endHz: 930,
        offsetMs: 0,
        durationMs: 80,
        attackMs: 2,
        gain: 0.45,
      },
      {
        wave: 'triangle',
        startHz: 1240,
        endHz: 1240,
        offsetMs: 50,
        durationMs: 90,
        attackMs: 2,
        gain: 0.25,
      },
    ],
  },
  /** A rank cleared: a quick rising major arpeggio (C, E, G an octave up). */
  clear: {
    category: 'sfx',
    recipe: [
      {
        wave: 'triangle',
        startHz: 523,
        endHz: 523,
        offsetMs: 0,
        durationMs: 120,
        attackMs: 3,
        gain: 0.35,
      },
      {
        wave: 'triangle',
        startHz: 659,
        endHz: 659,
        offsetMs: 70,
        durationMs: 120,
        attackMs: 3,
        gain: 0.35,
      },
      {
        wave: 'triangle',
        startHz: 784,
        endHz: 784,
        offsetMs: 140,
        durationMs: 200,
        attackMs: 3,
        gain: 0.35,
      },
    ],
  },
  /** The ranks advance: a low thump with a soft scrape of noise. */
  march: {
    category: 'sfx',
    recipe: [
      {
        wave: 'sine',
        startHz: 160,
        endHz: 100,
        offsetMs: 0,
        durationMs: 200,
        attackMs: 5,
        gain: 0.5,
      },
      {
        wave: 'noise',
        startHz: 0,
        endHz: 0,
        offsetMs: 10,
        durationMs: 140,
        attackMs: 10,
        gain: 0.1,
        seed: 5,
      },
    ],
  },
  /** The warning: a square falling a sixth, the heaviest sound of the bank. */
  overrun: {
    category: 'sfx',
    recipe: [
      {
        wave: 'square',
        startHz: 300,
        endHz: 180,
        offsetMs: 0,
        durationMs: 340,
        attackMs: 2,
        gain: 0.4,
      },
    ],
  },
};
