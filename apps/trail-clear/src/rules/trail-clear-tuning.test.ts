// apps/trail-clear/src/rules/trail-clear-tuning.test.ts
import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';

import { TILE_KINDS } from './tiles.ts';
import { TUNING, knobsFor, loopPoints } from './trail-clear-tuning.ts';

import type { DifficultyKnobs } from './trail-clear-tuning.ts';

/** Share of the row's deal that has no grass edge at all (only fits the inner cells). */
function noGrassShare(knobs: DifficultyKnobs): number {
  const total = TILE_KINDS.reduce((sum, kind) => sum + knobs.weights[kind], 0);
  return (knobs.weights.bridge + knobs.weights['twin-bend']) / total;
}

describe('knobsFor', () => {
  it('maps the level scale 0..99 onto four rows in equal bands, easiest first', () => {
    const bags = [0, 24, 25, 49, 50, 74, 75, 99].map((difficulty) => knobsFor(difficulty).bag);
    expect(bags).toStrictEqual([24, 24, 28, 28, 32, 32, 36, 36]);
  });

  it('gives the endless difficulty the endless row, whose bag never empties', () => {
    expect(knobsFor(ENDLESS_DIFFICULTY)).toStrictEqual(TUNING.endlessRow);
    expect(TUNING.endlessRow.bag).toBe(0);
  });

  it('clamps a difficulty below the scale to the first row', () => {
    expect(knobsFor(-5)).toStrictEqual(TUNING.levelRows[0]);
  });

  it('makes every row harder than the one before: a bigger bag, fewer helpful tiles, no fewer inner-only tiles', () => {
    TUNING.levelRows.slice(1).forEach((row, index) => {
      const previous = pickAt(TUNING.levelRows, index);
      expect(row.bag).toBeGreaterThan(previous.bag);
      expect(row.helpfulShare).toBeLessThan(previous.helpfulShare);
      expect(noGrassShare(row)).toBeGreaterThanOrEqual(noGrassShare(previous));
    });
  });

  it('deals every row a ford, so a double can always come', () => {
    for (const row of [...TUNING.levelRows, TUNING.endlessRow])
      expect(row.weights.ford).toBeGreaterThan(0);
  });
});

describe('loopPoints', () => {
  it('pays tilePoints times the square of the loop size (a long loop is worth the risk)', () => {
    expect([2, 3, 4, 8].map((size) => loopPoints(size))).toStrictEqual([40, 90, 160, 640]);
  });
});
