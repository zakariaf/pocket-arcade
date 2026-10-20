// apps/toggle-drop/src/sounds/sound-bank.ts
import type { SoundBank } from '@e07/shell/services/audio/audio-port.ts';

/**
 * Toggle Drop's five sounds, exactly the ids its buildTimeline cues: drop (a ball leaves the
 * chute), click (a switch flips), catch (a cup takes the ball), gutter (a ball is lost) and cup (a
 * cup is now full). The Shell adds its own ui.* sounds, the win and lose included (composeSoundBank).
 */
export const SOUND_BANK: SoundBank = {
  /** A soft plink as the ball leaves the chute: a short sine falling a fourth. */
  drop: {
    category: 'sfx',
    recipe: [
      {
        wave: 'sine',
        startHz: 760,
        endHz: 560,
        offsetMs: 0,
        durationMs: 90,
        attackMs: 3,
        gain: 0.42,
      },
    ],
  },
  /** The most repeated sound (every switch a ball passes), so the quietest: a tiny high tick. */
  click: {
    category: 'sfx',
    recipe: [
      {
        wave: 'triangle',
        startHz: 1500,
        endHz: 1150,
        offsetMs: 0,
        durationMs: 35,
        attackMs: 1,
        gain: 0.26,
      },
    ],
  },
  /** A wooden tok as a cup takes the ball: a falling sine over a short soft noise. */
  catch: {
    category: 'sfx',
    recipe: [
      {
        wave: 'sine',
        startHz: 520,
        endHz: 360,
        offsetMs: 0,
        durationMs: 130,
        attackMs: 2,
        gain: 0.5,
      },
      {
        wave: 'noise',
        startHz: 0,
        endHz: 0,
        offsetMs: 0,
        durationMs: 40,
        attackMs: 2,
        gain: 0.1,
        seed: 5,
      },
    ],
  },
  /** A dull low thud for a ball lost in the gutter: kept soft, a miss is not a punishment. */
  gutter: {
    category: 'sfx',
    recipe: [
      {
        wave: 'triangle',
        startHz: 170,
        endHz: 110,
        offsetMs: 0,
        durationMs: 150,
        attackMs: 4,
        gain: 0.4,
      },
    ],
  },
  /** A cup is full: a bright rising two-note chime, the payoff. */
  cup: {
    category: 'sfx',
    recipe: [
      {
        wave: 'sine',
        startHz: 660,
        endHz: 660,
        offsetMs: 0,
        durationMs: 180,
        attackMs: 4,
        gain: 0.42,
      },
      {
        wave: 'sine',
        startHz: 990,
        endHz: 990,
        offsetMs: 90,
        durationMs: 260,
        attackMs: 4,
        gain: 0.42,
      },
    ],
  },
};
