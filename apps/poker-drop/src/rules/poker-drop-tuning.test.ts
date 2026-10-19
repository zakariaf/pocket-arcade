// apps/poker-drop/src/rules/poker-drop-tuning.test.ts
import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';

import { TUNING, knobsFor, riseIntervalFor } from './poker-drop-tuning.ts';

describe('knobsFor', () => {
  // spec 8.1: levels rise in difficulty; one 0..100 scale picks a tuning row (rowFor).
  it('maps the level scale 0..99 onto four rows in equal bands, easiest first', () => {
    const minRanks = [0, 24, 25, 49, 50, 74, 75, 99].map(
      (difficulty) => knobsFor(difficulty).minRank,
    );
    expect(minRanks).toStrictEqual([9, 9, 5, 5, 3, 3, 2, 2]);
  });

  it('returns the endless row at difficulty 100: goal 0, never won', () => {
    expect(knobsFor(ENDLESS_DIFFICULTY)).toStrictEqual(TUNING.endlessRow);
    expect(knobsFor(ENDLESS_DIFFICULTY).goal).toBe(0);
  });

  it('clamps difficulties below the scale to the first row', () => {
    expect(knobsFor(-5)).toStrictEqual(TUNING.levelRows[0]);
    expect(knobsFor(250)).toStrictEqual(TUNING.endlessRow);
  });

  it('makes every row at least as hard as the one before: a longer deck, no fewer hands', () => {
    TUNING.levelRows.forEach((row, index) => {
      const previous = TUNING.levelRows[index - 1] ?? row;
      expect(row.minRank).toBeLessThanOrEqual(previous.minRank);
      expect(row.goal).toBeGreaterThanOrEqual(previous.goal);
      expect(row.preparedRows).toBeLessThanOrEqual(previous.preparedRows);
      expect(row.riseEvery).toBeLessThanOrEqual(previous.riseEvery);
    });
  });

  it('keeps every row playable: a positive goal and no more prepared rows than dealt rows', () => {
    for (const row of TUNING.levelRows) {
      expect(row.goal).toBeGreaterThan(0);
      expect(row.preparedRows).toBeLessThanOrEqual(row.openingRows);
      expect(row.openingRows).toBeLessThan(TUNING.wellRows);
      expect(row.riseEvery).toBeGreaterThan(3);
    }
  });
});

describe('riseIntervalFor', () => {
  it('keeps the rise interval of a level row for the whole level', () => {
    expect(riseIntervalFor(0, 1)).toBe(knobsFor(0).riseEvery);
    expect(riseIntervalFor(80, 500)).toBe(knobsFor(80).riseEvery);
  });

  it('makes the endless rows rise one drop sooner every endlessRampEvery drops, down to the minimum', () => {
    const start = TUNING.endlessRow.riseEvery;
    const intervals = [0, 39, 40, 80, 10_000].map((drops) =>
      riseIntervalFor(ENDLESS_DIFFICULTY, drops),
    );
    expect(intervals).toStrictEqual([start, start, start - 1, start - 2, TUNING.endlessRiseMin]);
  });
});
