// apps/scrap-shove/src/sounds/sound-bank.ts
import type { SoundBank } from '@e07/shell/services/audio/audio-port.ts';

/**
 * Scrap Shove's seven sounds, exactly the ids its buildTimeline cues: step (the player steps),
 * robot-step (the robots step), shove (the player shoves scrap), crash (robots crash or wreck),
 * crush (scrap lands on a robot), smash (a heavy robot smashes a heap) and caught (a robot reaches
 * the player). Winning and losing sound through the Shell's ui.win and ui.lose (composeSoundBank).
 */
export const SOUND_BANK: SoundBank = {
  /** Every turn, so among the quietest: a short soft triangle tap. */
  step: {
    category: 'sfx',
    recipe: [
      {
        wave: 'triangle',
        startHz: 620,
        endHz: 480,
        offsetMs: 0,
        durationMs: 60,
        attackMs: 2,
        gain: 0.3,
      },
    ],
  },
  /** Every turn too: a low tin clank, played once per robot phase. */
  'robot-step': {
    category: 'sfx',
    minIntervalMs: 60,
    recipe: [
      {
        wave: 'triangle',
        startHz: 260,
        endHz: 210,
        offsetMs: 0,
        durationMs: 70,
        attackMs: 2,
        gain: 0.28,
      },
    ],
  },
  /** Scrap scraping across the floor: soft noise under a falling triangle. */
  shove: {
    category: 'sfx',
    recipe: [
      {
        wave: 'triangle',
        startHz: 320,
        endHz: 220,
        offsetMs: 0,
        durationMs: 130,
        attackMs: 4,
        gain: 0.36,
      },
      {
        wave: 'noise',
        startHz: 0,
        endHz: 0,
        offsetMs: 0,
        durationMs: 150,
        attackMs: 6,
        gain: 0.14,
        seed: 5,
      },
    ],
  },
  /** The payoff: a metal crunch, a noise burst over a square falling an octave. */
  crash: {
    category: 'sfx',
    minIntervalMs: 60,
    recipe: [
      {
        wave: 'noise',
        startHz: 0,
        endHz: 0,
        offsetMs: 0,
        durationMs: 220,
        attackMs: 2,
        gain: 0.4,
        seed: 11,
      },
      {
        wave: 'square',
        startHz: 240,
        endHz: 120,
        offsetMs: 0,
        durationMs: 180,
        attackMs: 2,
        gain: 0.26,
      },
    ],
  },
  /** Heavier than a crash: a low falling thump with a short rattle. */
  crush: {
    category: 'sfx',
    recipe: [
      {
        wave: 'sine',
        startHz: 170,
        endHz: 70,
        offsetMs: 0,
        durationMs: 280,
        attackMs: 4,
        gain: 0.5,
      },
      {
        wave: 'noise',
        startHz: 0,
        endHz: 0,
        offsetMs: 10,
        durationMs: 140,
        attackMs: 4,
        gain: 0.2,
        seed: 13,
      },
    ],
  },
  /** A heap breaking apart: a noise burst with a bright falling chip. */
  smash: {
    category: 'sfx',
    recipe: [
      {
        wave: 'noise',
        startHz: 0,
        endHz: 0,
        offsetMs: 0,
        durationMs: 180,
        attackMs: 2,
        gain: 0.34,
        seed: 17,
      },
      {
        wave: 'triangle',
        startHz: 900,
        endHz: 420,
        offsetMs: 0,
        durationMs: 120,
        attackMs: 2,
        gain: 0.22,
      },
    ],
  },
  /** A robot grabs the player: two quick square blips, a fourth down (the Shell's ui.lose follows). */
  caught: {
    category: 'sfx',
    recipe: [
      {
        wave: 'square',
        startHz: 440,
        endHz: 440,
        offsetMs: 0,
        durationMs: 80,
        attackMs: 2,
        gain: 0.32,
      },
      {
        wave: 'square',
        startHz: 330,
        endHz: 330,
        offsetMs: 90,
        durationMs: 110,
        attackMs: 2,
        gain: 0.32,
      },
    ],
  },
};
