// packages/shell/src/services/audio/synth/synthesize-recipe.test.ts
import { RECIPE_TEST_RATE, recipeProblems } from './recipe-problems.ts';
import { synthesizeRecipe } from './synthesize-recipe.ts';
import { UI_SOUNDS } from './ui-sounds.ts';

import type { SoundRecipe } from './synthesize-recipe.ts';

/** 32-bit FNV-1a over the float bits: one number that moves if any sample moves. */
function hashSamples(samples: Float32Array<ArrayBuffer>): number {
  let hash = 0x811c9dc5;
  for (const bits of new Uint32Array(samples.buffer)) {
    hash = Math.imul(hash ^ bits, 0x01000193) >>> 0;
  }
  return hash;
}

const NOISE = { wave: 'noise', startHz: 0, endHz: 0, attackMs: 4 } as const;

/** Every wave, two seeded noise layers, offsets, and a mix loud enough to be scaled to 0.9. */
const PINNED: Readonly<Record<string, SoundRecipe>> = {
  ...UI_SOUNDS,
  'noise-over-sweep': [
    {
      wave: 'sine',
      startHz: 300,
      endHz: 1200,
      offsetMs: 0,
      durationMs: 160,
      attackMs: 3,
      gain: 0.45,
    },
    { ...NOISE, offsetMs: 0, durationMs: 160, gain: 0.15, seed: 3 },
    { ...NOISE, offsetMs: 20, durationMs: 200, gain: 0.12, seed: 7 },
  ],
  'loud-layers': [
    {
      wave: 'square',
      startHz: 220,
      endHz: 110,
      offsetMs: 0,
      durationMs: 120,
      attackMs: 2,
      gain: 0.9,
    },
    {
      wave: 'triangle',
      startHz: 660,
      endHz: 990,
      offsetMs: 13,
      durationMs: 90,
      attackMs: 0,
      gain: 0.8,
    },
    { ...NOISE, offsetMs: 7, durationMs: 41, gain: 0.6, seed: 11 },
  ],
};

describe('synth recipes', () => {
  it.each(Object.entries(UI_SOUNDS))('renders %s as a clean, click-free buffer', (_id, recipe) => {
    expect(recipeProblems(recipe)).toStrictEqual([]);
  });

  it('renders identical bytes every time (seeded noise, no clocks)', () => {
    const noisy = [
      {
        wave: 'noise',
        startHz: 0,
        endHz: 0,
        offsetMs: 0,
        durationMs: 80,
        attackMs: 1,
        gain: 0.5,
        seed: 9,
      },
    ] as const;
    expect(synthesizeRecipe(noisy, RECIPE_TEST_RATE)).toStrictEqual(
      synthesizeRecipe(noisy, RECIPE_TEST_RATE),
    );
  });

  // Sample-exact pin of the synth's output (the gate and the owner's listening judged these bytes):
  // a refactor of the synth must leave every sample as it was.
  it('renders every pinned recipe to the same samples as before', () => {
    const hashes = Object.fromEntries(
      Object.entries(PINNED).map(([id, recipe]) => [
        id,
        hashSamples(synthesizeRecipe(recipe, RECIPE_TEST_RATE)),
      ]),
    );
    expect(hashes).toStrictEqual({
      'ui.tap': 447_977_621,
      'ui.toggle': 3_990_127_692,
      'ui.win': 2_992_915_796,
      'ui.lose': 1_885_492_893,
      'noise-over-sweep': 2_132_264_358,
      'loud-layers': 3_870_322_800,
    });
  });

  it('mixes layers at their offsets and scales loud mixes down to 0.9', () => {
    const tone = {
      wave: 'sine',
      startHz: 440,
      endHz: 440,
      offsetMs: 0,
      durationMs: 100,
      attackMs: 2,
      gain: 1,
    } as const;
    const samples = synthesizeRecipe([tone, { ...tone, offsetMs: 50 }], RECIPE_TEST_RATE);
    const peak = samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
    expect(samples).toHaveLength((150 / 1000) * RECIPE_TEST_RATE);
    expect(peak).toBeCloseTo(0.9, 5);
  });
});
