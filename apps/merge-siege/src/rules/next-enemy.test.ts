// apps/merge-siege/src/rules/next-enemy.test.ts
// The enemy waves come from the seed (spec 8.1: "The same seed always makes the same level"): the
// next enemy's column and number are drawn from the RNG kept in the state, weighted by the row.
import fc from 'fast-check';

import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { COLS } from './board-cells.ts';
import { ENEMY_VALUES, TUNING, knobsFor } from './merge-siege-tuning.ts';
import { drawNextEnemy, endlessSizeSteps } from './next-enemy.ts';

const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });

/** The numbers a row's weights allow, shifted up `steps` sizes. */
function allowedValues(difficulty: number, steps: number): number[] {
  const weights = knobsFor(difficulty).enemyWeights;
  return ENEMY_VALUES.filter((_, index) => (weights[index] ?? 0) > 0).map((value) => {
    let shifted = value;
    for (let step = 0; step < steps; step += 1) shifted *= 2;
    return shifted;
  });
}

describe('drawNextEnemy', () => {
  it('keeps the pinned first draws for seed 1 at difficulty 0', () => {
    let rng = seedRng(1);
    const draws = [];
    for (let draw = 0; draw < 4; draw += 1) {
      const next = drawNextEnemy({ rng, difficulty: 0, swipes: 0 });
      draws.push(next.next);
      rng = next.rng;
    }
    expect(draws).toStrictEqual(GOLDEN_SEED_1_DRAWS);
  });

  it('draws a column of the board and a number the row allows, for any seed and level', () => {
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 0, max: 99 }), (seed, difficulty) => {
        const { next } = drawNextEnemy({ rng: seedRng(seed), difficulty, swipes: 0 });
        expect(next.col).toBeGreaterThanOrEqual(0);
        expect(next.col).toBeLessThan(COLS);
        expect(allowedValues(difficulty, 0)).toContain(next.value);
      }),
    );
  });

  it('steps the endless numbers up one size every endlessStepEvery swipes, up to a cap', () => {
    const every = TUNING.endlessStepEvery;
    expect(endlessSizeSteps(ENDLESS_DIFFICULTY, every - 1)).toBe(0);
    expect(endlessSizeSteps(ENDLESS_DIFFICULTY, every)).toBe(1);
    expect(endlessSizeSteps(ENDLESS_DIFFICULTY, every * 100)).toBe(TUNING.endlessMaxSteps);
    expect(endlessSizeSteps(50, every * 3)).toBe(0);
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 0, max: 400 }), (seed, swipes) => {
        const { next } = drawNextEnemy({
          rng: seedRng(seed),
          difficulty: ENDLESS_DIFFICULTY,
          swipes,
        });
        expect(
          allowedValues(ENDLESS_DIFFICULTY, endlessSizeSteps(ENDLESS_DIFFICULTY, swipes)),
        ).toContain(next.value);
      }),
    );
  });
});

const GOLDEN_SEED_1_DRAWS = [
  { col: 2, value: 4 },
  { col: 2, value: 8 },
  { col: 3, value: 4 },
  { col: 2, value: 4 },
];
