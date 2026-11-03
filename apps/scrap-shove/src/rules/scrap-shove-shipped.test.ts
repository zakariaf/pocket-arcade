// apps/scrap-shove/src/rules/scrap-shove-shipped.test.ts
import { SCRAP_SHOVE_LEVELS } from '@e07/scrap-shove/levels/scrap-shove-levels.ts';

import { shippedTry } from './scrap-shove-shipped.ts';

describe('shippedTry', () => {
  // Spec 8.1 and 15.7: every shipped level was proven when its pack was generated, on the first
  // layout of its seed's stream the solver proves; the try says which layout that was.
  it('names the layout try that proved a shipped level: 1, 2 or as late as 5', () => {
    expect(shippedTry(356_075_057, 0)).toBe(1);
    expect(shippedTry(1_818_429_083, 10)).toBe(2);
    expect(shippedTry(3_828_754_964, 50)).toBe(3);
    expect(shippedTry(641_420_490, 96)).toBe(5);
  });

  it('knows every level of the packs by its seed and difficulty', () => {
    expect(SCRAP_SHOVE_LEVELS.table).toHaveLength(90);
    const tries = SCRAP_SHOVE_LEVELS.table.map((entry) => shippedTry(entry.seed, entry.difficulty));
    expect(tries.filter((value) => value === null)).toStrictEqual([]);
    expect(tries.filter((value) => value !== 1)).toHaveLength(15);
  });

  it('knows no other pair: a shipped seed at another difficulty, or the daily', () => {
    expect(shippedTry(356_075_057, 1)).toBeNull();
    expect(shippedTry(641_420_490, 45)).toBeNull();
    expect(shippedTry(2, 45)).toBeNull();
  });
});
