// apps/poker-drop/src/sounds/sound-bank.ts
import type { SoundBank } from '@e07/shell/services/audio/audio-port.ts';

/**
 * Poker Drop's twelve sounds, exactly the ids its buildTimeline cues: drop (a card lands), one
 * burst per hand kind (higher and longer as the hand gets rarer, a chord from the full house up),
 * cascade (a step's x2 badge), rise (a new row comes up), overflow (the well is full) and continue
 * (the top row clears). No music (lead decision L1). The Shell adds its own ui.* sounds, the win
 * and the lose included.
 */
export const SOUND_BANK: SoundBank = {
  /** The most repeated sound, so the quietest and shortest: a soft falling triangle tap. */
  drop: {
    category: 'sfx',
    recipe: [
      {
        wave: 'triangle',
        startHz: 330,
        endHz: 240,
        offsetMs: 0,
        durationMs: 60,
        attackMs: 2,
        gain: 0.3,
      },
    ],
  },
  /** Two pair, the most common hand: a short rising pop. */
  'burst-two-pair': {
    category: 'sfx',
    recipe: [
      {
        wave: 'sine',
        startHz: 440,
        endHz: 550,
        offsetMs: 0,
        durationMs: 180,
        attackMs: 3,
        gain: 0.42,
      },
    ],
  },
  /** Three of a kind: a little higher and longer. */
  'burst-three-of-a-kind': {
    category: 'sfx',
    recipe: [
      {
        wave: 'sine',
        startHz: 494,
        endHz: 618,
        offsetMs: 0,
        durationMs: 220,
        attackMs: 3,
        gain: 0.42,
      },
    ],
  },
  /** A straight: a longer climb, as the hand runs up. */
  'burst-straight': {
    category: 'sfx',
    recipe: [
      {
        wave: 'sine',
        startHz: 554,
        endHz: 692,
        offsetMs: 0,
        durationMs: 260,
        attackMs: 3,
        gain: 0.42,
      },
    ],
  },
  /** A flush: higher again, held a little longer. */
  'burst-flush': {
    category: 'sfx',
    recipe: [
      {
        wave: 'sine',
        startHz: 587,
        endHz: 734,
        offsetMs: 0,
        durationMs: 300,
        attackMs: 3,
        gain: 0.42,
      },
    ],
  },
  /** A full house: the first chord, a fifth above the glide. */
  'burst-full-house': {
    category: 'sfx',
    recipe: [
      {
        wave: 'sine',
        startHz: 659,
        endHz: 824,
        offsetMs: 0,
        durationMs: 360,
        attackMs: 3,
        gain: 0.42,
      },
      {
        wave: 'triangle',
        startHz: 988,
        endHz: 988,
        offsetMs: 40,
        durationMs: 320,
        attackMs: 4,
        gain: 0.2,
      },
    ],
  },
  /** Four of a kind: a bigger, longer chord. */
  'burst-four-of-a-kind': {
    category: 'sfx',
    recipe: [
      {
        wave: 'sine',
        startHz: 740,
        endHz: 925,
        offsetMs: 0,
        durationMs: 420,
        attackMs: 3,
        gain: 0.42,
      },
      {
        wave: 'triangle',
        startHz: 1110,
        endHz: 1110,
        offsetMs: 40,
        durationMs: 380,
        attackMs: 4,
        gain: 0.2,
      },
    ],
  },
  /** A straight flush, the rarest hand: the highest, longest chord. */
  'burst-straight-flush': {
    category: 'sfx',
    recipe: [
      {
        wave: 'sine',
        startHz: 880,
        endHz: 1100,
        offsetMs: 0,
        durationMs: 520,
        attackMs: 3,
        gain: 0.42,
      },
      {
        wave: 'triangle',
        startHz: 1320,
        endHz: 1320,
        offsetMs: 40,
        durationMs: 480,
        attackMs: 4,
        gain: 0.2,
      },
    ],
  },
  /** The x2 badge of a cascade step: a quick rising blip. */
  cascade: {
    category: 'sfx',
    recipe: [
      {
        wave: 'triangle',
        startHz: 600,
        endHz: 1200,
        offsetMs: 0,
        durationMs: 140,
        attackMs: 3,
        gain: 0.42,
      },
    ],
  },
  /** A new row rises from the floor: a low swelling hum over soft noise. */
  rise: {
    category: 'sfx',
    recipe: [
      {
        wave: 'sine',
        startHz: 110,
        endHz: 165,
        offsetMs: 0,
        durationMs: 300,
        attackMs: 30,
        gain: 0.5,
      },
      {
        wave: 'noise',
        startHz: 0,
        endHz: 0,
        offsetMs: 0,
        durationMs: 220,
        attackMs: 20,
        gain: 0.1,
        seed: 11,
      },
    ],
  },
  /** The well is full: a falling, buzzy slide that ends the run (rare, so it may be long). */
  overflow: {
    category: 'sfx',
    recipe: [
      {
        wave: 'square',
        startHz: 300,
        endHz: 120,
        offsetMs: 0,
        durationMs: 600,
        attackMs: 6,
        gain: 0.32,
      },
      {
        wave: 'triangle',
        startHz: 150,
        endHz: 80,
        offsetMs: 60,
        durationMs: 560,
        attackMs: 8,
        gain: 0.25,
      },
    ],
  },
  /** The continue clears the top row: a bright upward sweep with a sparkle on top. */
  continue: {
    category: 'sfx',
    recipe: [
      {
        wave: 'sine',
        startHz: 400,
        endHz: 1000,
        offsetMs: 0,
        durationMs: 450,
        attackMs: 6,
        gain: 0.45,
      },
      {
        wave: 'triangle',
        startHz: 800,
        endHz: 1600,
        offsetMs: 120,
        durationMs: 330,
        attackMs: 6,
        gain: 0.18,
      },
    ],
  },
};
