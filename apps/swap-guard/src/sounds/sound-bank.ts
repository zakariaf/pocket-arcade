// apps/swap-guard/src/sounds/sound-bank.ts
import type { SoundBank } from '@e07/shell/services/audio/audio-port.ts';

/**
 * Swap Guard's three sounds, exactly the ids its buildTimeline cues: swap (the guard trades places
 * with a neighbour, and the continue's swap back), strike (the enemies' strikes flash across the
 * board) and hit (enemies caught in a strike are knocked out). The Shell adds its own ui.* sounds,
 * the win and lose included (composeSoundBank), so the guard being hit carries only its haptic.
 * No music (spec 8.7, lead decision L1).
 */
export const SOUND_BANK: SoundBank = {
  /** Every move plays it, so it is the quietest: a soft sine slide up and back down. */
  swap: {
    category: 'sfx',
    recipe: [
      {
        wave: 'sine',
        startHz: 440,
        endHz: 660,
        offsetMs: 0,
        durationMs: 60,
        attackMs: 2,
        gain: 0.25,
      },
      {
        wave: 'sine',
        startHz: 660,
        endHz: 494,
        offsetMs: 50,
        durationMs: 60,
        attackMs: 2,
        gain: 0.22,
      },
    ],
  },
  /** The strikes land: a short bright triangle zing falling an octave, with a thin noise swish. */
  strike: {
    category: 'sfx',
    recipe: [
      {
        wave: 'triangle',
        startHz: 1320,
        endHz: 660,
        offsetMs: 0,
        durationMs: 140,
        attackMs: 2,
        gain: 0.35,
      },
      {
        wave: 'noise',
        startHz: 0,
        endHz: 0,
        offsetMs: 0,
        durationMs: 70,
        attackMs: 2,
        gain: 0.1,
        seed: 11,
      },
    ],
  },
  /** The payoff: a low square knock, then two bright triangle notes a fifth apart. */
  hit: {
    category: 'sfx',
    recipe: [
      {
        wave: 'square',
        startHz: 196,
        endHz: 130,
        offsetMs: 0,
        durationMs: 90,
        attackMs: 2,
        gain: 0.3,
      },
      {
        wave: 'triangle',
        startHz: 659,
        endHz: 659,
        offsetMs: 70,
        durationMs: 110,
        attackMs: 2,
        gain: 0.45,
      },
      {
        wave: 'triangle',
        startHz: 988,
        endHz: 988,
        offsetMs: 160,
        durationMs: 170,
        attackMs: 2,
        gain: 0.4,
      },
    ],
  },
};
