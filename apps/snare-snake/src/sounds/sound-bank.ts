// apps/snare-snake/src/sounds/sound-bank.ts
import type { SoundBank } from '@e07/shell/services/audio/audio-port.ts';

/**
 * Snare Snake's four sounds, exactly the ids its buildTimeline cues: step (the snake slides one
 * cell), loop (the snake bites its own body and the loop flashes), catch (the critters inside are
 * snared) and bonus (a continue's extra moves pop in). The Shell adds its own ui.* sounds, the win
 * and lose included (composeSoundBank). No music (spec 8.7, lead decision L1).
 */
export const SOUND_BANK: SoundBank = {
  /** Every move plays it, so it is the quietest: a soft, short sine tick falling a fifth. */
  step: {
    category: 'sfx',
    recipe: [
      {
        wave: 'sine',
        startHz: 600,
        endHz: 400,
        offsetMs: 0,
        durationMs: 60,
        attackMs: 2,
        gain: 0.3,
      },
    ],
  },
  /** The bite that closes the loop: a quick rising triangle whoop with a short noise snap. */
  loop: {
    category: 'sfx',
    recipe: [
      {
        wave: 'triangle',
        startHz: 330,
        endHz: 660,
        offsetMs: 0,
        durationMs: 180,
        attackMs: 4,
        gain: 0.45,
      },
      {
        wave: 'noise',
        startHz: 0,
        endHz: 0,
        offsetMs: 0,
        durationMs: 50,
        attackMs: 2,
        gain: 0.12,
        seed: 5,
      },
    ],
  },
  /** The payoff: two bright triangle notes a fourth apart, then a high sparkle. */
  catch: {
    category: 'sfx',
    recipe: [
      {
        wave: 'triangle',
        startHz: 784,
        endHz: 784,
        offsetMs: 0,
        durationMs: 110,
        attackMs: 2,
        gain: 0.45,
      },
      {
        wave: 'triangle',
        startHz: 1047,
        endHz: 1047,
        offsetMs: 90,
        durationMs: 160,
        attackMs: 2,
        gain: 0.4,
      },
      {
        wave: 'sine',
        startHz: 2093,
        endHz: 2349,
        offsetMs: 180,
        durationMs: 140,
        attackMs: 3,
        gain: 0.15,
      },
    ],
  },
  /** Extra moves from a continue: a short rising square blip, then its octave. */
  bonus: {
    category: 'sfx',
    recipe: [
      {
        wave: 'square',
        startHz: 392,
        endHz: 523,
        offsetMs: 0,
        durationMs: 100,
        attackMs: 2,
        gain: 0.35,
      },
      {
        wave: 'square',
        startHz: 784,
        endHz: 1047,
        offsetMs: 80,
        durationMs: 140,
        attackMs: 2,
        gain: 0.3,
      },
    ],
  },
};
