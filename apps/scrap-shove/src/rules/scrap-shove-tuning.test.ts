// apps/scrap-shove/src/rules/scrap-shove-tuning.test.ts
import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';

import { TUNING, knobsFor } from './scrap-shove-tuning.ts';

import type { DifficultyKnobs } from './scrap-shove-tuning.ts';

function robotsOf(knobs: DifficultyKnobs): number {
  return knobs.normal + knobs.fast + knobs.heavy;
}

describe('knobsFor', () => {
  it('maps the level scale 0..99 onto four rows in equal bands, easiest first', () => {
    const robots = [0, 24, 25, 49, 50, 74, 75, 99].map((difficulty) =>
      robotsOf(knobsFor(difficulty)),
    );
    expect(robots).toStrictEqual([5, 5, 7, 7, 9, 9, 12, 12]);
  });

  it('clamps difficulties outside the scale to the first and the last row', () => {
    expect(knobsFor(-5)).toStrictEqual(TUNING.levelRows[0]);
    expect(knobsFor(ENDLESS_DIFFICULTY)).toStrictEqual(TUNING.levelRows.at(-1));
  });

  it('adds robots in every harder row, and fast and heavy ones by the hardest (spec 13: floors that get denser)', () => {
    TUNING.levelRows.forEach((row, index) => {
      const previous = TUNING.levelRows[index - 1];
      if (previous === undefined) return;
      expect(robotsOf(row)).toBeGreaterThan(robotsOf(previous));
      expect(row.fast).toBeGreaterThanOrEqual(previous.fast);
      expect(row.heavy).toBeGreaterThanOrEqual(previous.heavy);
    });
    const hardest = knobsFor(99);
    expect(hardest.fast).toBeGreaterThan(knobsFor(0).fast);
    expect(hardest.heavy).toBeGreaterThan(knobsFor(0).heavy);
  });

  it('gives every heavy robot of every row a heap for its lane', () => {
    TUNING.levelRows.forEach((row) => {
      expect(row.heaps).toBeGreaterThanOrEqual(row.heavy);
    });
  });
});
