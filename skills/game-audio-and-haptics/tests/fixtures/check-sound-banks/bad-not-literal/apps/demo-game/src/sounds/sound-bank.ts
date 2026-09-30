// apps/demo-game/src/sounds/sound-bank.ts
import type { SoundBank } from '@e07/shell/services/audio/audio-port.ts';

/**
 * The game's sound set. Each id is a kebab-case noun named by a `cue: { sound: '<id>' }` in
 * buildTimeline; the Shell loads its own ui.* sounds beside it (composeSoundBank). Recipes are
 * literal data so the quality gate and the WAV preview can read them. Start from the sound
 * design guide, then tune by ear with the WAV preview. These three match the template board's
 * cues (Tap Flip): a cell turns over, the board clears, a continue adds moves.
 */
const FLIP_GAIN = 0.45;

export const SOUND_BANK: SoundBank = {
  /** A cell turns over: a short triangle falling about 30 %. The most repeated, so the quietest. */
  flip: {
    category: 'sfx',
    recipe: [
      {
        wave: 'triangle',
        startHz: 520,
        endHz: 380,
        offsetMs: 0,
        durationMs: 70,
        attackMs: 2,
        gain: FLIP_GAIN,
      },
    ],
  },
  /** The board clears: a rising sine sweep over a little soft noise. */
  clear: {
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
  /** A continue adds moves: two rising triangle notes (E5, then A5). */
  bonus: {
    category: 'sfx',
    recipe: [
      {
        wave: 'triangle',
        startHz: 659.25,
        endHz: 659.25,
        offsetMs: 0,
        durationMs: 90,
        attackMs: 2,
        gain: 0.4,
      },
      {
        wave: 'triangle',
        startHz: 880,
        endHz: 880,
        offsetMs: 80,
        durationMs: 140,
        attackMs: 2,
        gain: 0.4,
      },
    ],
  },
};
