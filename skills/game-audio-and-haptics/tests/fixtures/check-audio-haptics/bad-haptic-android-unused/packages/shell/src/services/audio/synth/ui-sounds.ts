// packages/shell/src/services/audio/synth/ui-sounds.ts
import type { SoundRecipe } from './synthesize-recipe.ts';

/** Shell menu sounds (category 'ui'). Games add their own bank; ids must not collide. */
export const UI_SOUNDS = {
  'ui.tap': [
    {
      wave: 'triangle',
      startHz: 1400,
      endHz: 900,
      offsetMs: 0,
      durationMs: 45,
      attackMs: 1,
      gain: 0.35,
    },
  ],
  'ui.toggle': [
    {
      wave: 'sine',
      startHz: 660,
      endHz: 660,
      offsetMs: 0,
      durationMs: 60,
      attackMs: 2,
      gain: 0.35,
    },
    {
      wave: 'sine',
      startHz: 990,
      endHz: 990,
      offsetMs: 45,
      durationMs: 70,
      attackMs: 2,
      gain: 0.3,
    },
  ],
  'ui.win': [
    {
      wave: 'triangle',
      startHz: 523.25,
      endHz: 523.25,
      offsetMs: 0,
      durationMs: 140,
      attackMs: 4,
      gain: 0.4,
    },
    {
      wave: 'triangle',
      startHz: 659.25,
      endHz: 659.25,
      offsetMs: 110,
      durationMs: 140,
      attackMs: 4,
      gain: 0.4,
    },
    {
      wave: 'triangle',
      startHz: 783.99,
      endHz: 783.99,
      offsetMs: 220,
      durationMs: 320,
      attackMs: 4,
      gain: 0.45,
    },
  ],
  'ui.lose': [
    {
      wave: 'square',
      startHz: 330,
      endHz: 196,
      offsetMs: 0,
      durationMs: 420,
      attackMs: 6,
      gain: 0.3,
    },
  ],
} as const satisfies Readonly<Record<string, SoundRecipe>>;
