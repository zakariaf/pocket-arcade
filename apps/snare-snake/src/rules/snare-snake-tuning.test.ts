// apps/snare-snake/src/rules/snare-snake-tuning.test.ts
import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';

import { TUNING, knobsFor } from './snare-snake-tuning.ts';

describe('knobsFor', () => {
  it('maps the level scale 0..99 onto the four rows in equal bands, easiest first', () => {
    const critters = [0, 24, 25, 49, 50, 74, 75, 99].map(
      (difficulty) => knobsFor(difficulty).critters,
    );
    expect(critters).toStrictEqual([4, 4, 5, 5, 6, 6, 7, 7]);
  });

  it('returns the row whose lower bound is the largest at or below the difficulty', () => {
    expect(knobsFor(45)).toStrictEqual(TUNING.levelRows[1]);
    expect(knobsFor(60)).toStrictEqual(TUNING.levelRows[2]);
  });

  it('clamps difficulties outside the scale to the first and the last row', () => {
    expect(knobsFor(-5)).toStrictEqual(TUNING.levelRows[0]);
    expect(knobsFor(ENDLESS_DIFFICULTY)).toStrictEqual(TUNING.levelRows.at(-1));
  });

  it('makes every row at least as hard as the one before (more critters, a board as big)', () => {
    TUNING.levelRows.forEach((row, index) => {
      const previous = TUNING.levelRows[index - 1] ?? row;
      expect(row.critters).toBeGreaterThanOrEqual(previous.critters);
      expect(row.cols * row.rows).toBeGreaterThanOrEqual(previous.cols * previous.rows);
      expect(row.hopEvery).toBeLessThanOrEqual(previous.hopEvery);
      expect(row.nestCritters).toBeLessThanOrEqual(previous.nestCritters);
    });
  });

  it('keeps every board at most 8 cells wide, so a cell stays 44 pt or more on a phone (spec 8.11)', () => {
    for (const row of TUNING.levelRows) expect(row.cols).toBeLessThanOrEqual(8);
  });

  it('starts the snake long enough to close its coil (the design fix: the toy started at 5)', () => {
    for (const row of TUNING.levelRows) {
      const ringCells = 2 * (Math.max(row.nestCritters, 1) + 1) + 4;
      expect(TUNING.startLength).toBeGreaterThanOrEqual(ringCells);
    }
  });
});
