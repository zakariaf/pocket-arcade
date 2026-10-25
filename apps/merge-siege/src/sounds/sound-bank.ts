// apps/merge-siege/src/sounds/sound-bank.ts
import type { SoundBank } from '@e07/shell/services/audio/audio-port.ts';

/**
 * Merge Siege's six sounds, exactly the ids its buildTimeline cues: slide (the tiles move), merge
 * (two tiles become one), smash (a tile smashes an enemy), crack (a tile is lost to a bigger
 * enemy), march (the enemies step down) and enter (the next enemy steps in from the gate). Winning
 * and losing play the Shell's ui.win and ui.lose; the Shell adds its ui.* sounds (composeSoundBank).
 */
export const SOUND_BANK: SoundBank = {
  /** Heard on every swipe, so the quietest: a short triangle swish falling a fourth. */
  slide: {
    category: 'sfx',
    recipe: [
      {
        wave: 'triangle',
        startHz: 440,
        endHz: 330,
        offsetMs: 0,
        durationMs: 60,
        attackMs: 2,
        gain: 0.3,
      },
    ],
  },
  /** A bright pop: a rising triangle with a higher blip 60 ms later. */
  merge: {
    category: 'sfx',
    recipe: [
      {
        wave: 'triangle',
        startHz: 660,
        endHz: 990,
        offsetMs: 0,
        durationMs: 90,
        attackMs: 2,
        gain: 0.42,
      },
      {
        wave: 'triangle',
        startHz: 1320,
        endHz: 1320,
        offsetMs: 60,
        durationMs: 100,
        attackMs: 2,
        gain: 0.25,
      },
    ],
  },
  /** A crunchy hit: a square falling an octave over a short burst of noise; at most every 60 ms. */
  smash: {
    category: 'sfx',
    minIntervalMs: 60,
    recipe: [
      {
        wave: 'square',
        startHz: 220,
        endHz: 110,
        offsetMs: 0,
        durationMs: 120,
        attackMs: 1,
        gain: 0.32,
      },
      {
        wave: 'noise',
        startHz: 0,
        endHz: 0,
        offsetMs: 0,
        durationMs: 90,
        attackMs: 2,
        gain: 0.18,
        seed: 5,
      },
    ],
  },
  /** The warning when a tile is lost: a square falling a sixth, the heaviest effect. */
  crack: {
    category: 'sfx',
    recipe: [
      {
        wave: 'square',
        startHz: 330,
        endHz: 196,
        offsetMs: 0,
        durationMs: 300,
        attackMs: 2,
        gain: 0.38,
      },
    ],
  },
  /** One low step of the siege: a falling sine thud. */
  march: {
    category: 'sfx',
    recipe: [
      {
        wave: 'sine',
        startHz: 140,
        endHz: 100,
        offsetMs: 0,
        durationMs: 110,
        attackMs: 3,
        gain: 0.4,
      },
    ],
  },
  /** The next enemy drops in from the gate: a sine whistle falling an octave. */
  enter: {
    category: 'sfx',
    recipe: [
      {
        wave: 'sine',
        startHz: 880,
        endHz: 440,
        offsetMs: 0,
        durationMs: 160,
        attackMs: 4,
        gain: 0.32,
      },
    ],
  },
};
