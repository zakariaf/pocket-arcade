// apps/line-siege/src/sounds/sound-bank.ts
import type { SoundBank } from '@e07/shell/services/audio/audio-port.ts';

/**
 * Line Siege's six sounds, exactly the ids its buildTimeline cues: place (a block lands), beam (a
 * cleared column fires), shock (cleared rows send the wave), hit (a monster takes damage), pop (a
 * monster is defeated) and breach (a monster breaks the wall). The continue plays no board sound.
 * The Shell adds its own ui.* sounds (composeSoundBank).
 */
export const SOUND_BANK: SoundBank = {
  /** The most repeated sound, so the quietest: a short triangle falling about 30 %. */
  place: {
    category: 'sfx',
    recipe: [
      {
        wave: 'triangle',
        startHz: 520,
        endHz: 380,
        offsetMs: 0,
        durationMs: 70,
        attackMs: 2,
        gain: 0.5,
      },
    ],
  },
  /** A rising sine sweep over a little soft noise. */
  beam: {
    category: 'sfx',
    recipe: [
      {
        wave: 'sine',
        startHz: 300,
        endHz: 1200,
        offsetMs: 0,
        durationMs: 240,
        attackMs: 8,
        gain: 0.45,
      },
      {
        wave: 'noise',
        startHz: 0,
        endHz: 0,
        offsetMs: 0,
        durationMs: 160,
        attackMs: 4,
        gain: 0.15,
        seed: 3,
      },
    ],
  },
  /** A low thump that rolls up the lanes: a falling sine under a short noise swell. */
  shock: {
    category: 'sfx',
    recipe: [
      {
        wave: 'sine',
        startHz: 180,
        endHz: 90,
        offsetMs: 0,
        durationMs: 260,
        attackMs: 6,
        gain: 0.5,
      },
      {
        wave: 'noise',
        startHz: 0,
        endHz: 0,
        offsetMs: 20,
        durationMs: 200,
        attackMs: 20,
        gain: 0.12,
        seed: 7,
      },
    ],
  },
  /** A square falling an octave; rapid hits in one turn play at most every 60 ms. */
  hit: {
    category: 'sfx',
    minIntervalMs: 60,
    recipe: [
      {
        wave: 'square',
        startHz: 180,
        endHz: 90,
        offsetMs: 0,
        durationMs: 120,
        attackMs: 1,
        gain: 0.35,
      },
    ],
  },
  /** A bright pop: a rising triangle with a higher blip 60 ms later. */
  pop: {
    category: 'sfx',
    recipe: [
      {
        wave: 'triangle',
        startHz: 660,
        endHz: 990,
        offsetMs: 0,
        durationMs: 90,
        attackMs: 2,
        gain: 0.45,
      },
      {
        wave: 'triangle',
        startHz: 1320,
        endHz: 1320,
        offsetMs: 60,
        durationMs: 110,
        attackMs: 2,
        gain: 0.3,
      },
    ],
  },
  /** The warning: a square falling a sixth, heavier than a hit. */
  breach: {
    category: 'sfx',
    recipe: [
      {
        wave: 'square',
        startHz: 330,
        endHz: 196,
        offsetMs: 0,
        durationMs: 320,
        attackMs: 2,
        gain: 0.4,
      },
    ],
  },
};
