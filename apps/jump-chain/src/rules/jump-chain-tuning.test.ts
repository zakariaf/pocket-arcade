// apps/jump-chain/src/rules/jump-chain-tuning.test.ts
import fc from 'fast-check';

import { ENDLESS_DIFFICULTY, rowFor } from '@e07/game-kit/contract/difficulty.ts';

import { TUNING, chainPoints, knobsFor } from './jump-chain-tuning.ts';

describe('knobsFor (Jump Chain is turn-based: one difficulty scale 0..100)', () => {
  it('maps the level scale 0..99 onto the four rows in equal bands, easiest first', () => {
    const rows = [0, 24, 25, 49, 50, 74, 75, 99].map((difficulty) =>
      TUNING.levelRows.findIndex((row) => row === knobsFor(difficulty)),
    );
    expect(rows).toStrictEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it('returns the endless row at difficulty 100: no level ranks, so it is never won', () => {
    expect(knobsFor(ENDLESS_DIFFICULTY)).toBe(TUNING.endlessRow);
    expect(TUNING.endlessRow.ranks).toBe(0);
  });

  it('clamps difficulties below the scale to the first row', () => {
    expect(knobsFor(-5)).toBe(TUNING.levelRows[0]);
  });

  it('makes every row at least as hard as the one before: more ranks, a march at least as fast', () => {
    TUNING.levelRows.forEach((row, index) => {
      expect(row.ranks).toBeGreaterThanOrEqual(2);
      const previous = TUNING.levelRows[index - 1] ?? row;
      expect(row.ranks).toBeGreaterThanOrEqual(previous.ranks);
      expect(row.marchEvery).toBeLessThanOrEqual(previous.marchEvery);
    });
  });

  it('lets the easiest row march only every 6 moves or slower: the warm-up', () => {
    const [first, second] = TUNING.levelRows;
    expect(first.marchEvery).toBeGreaterThanOrEqual(6);
    expect(first.marchEvery).toBeGreaterThan(second.marchEvery);
  });

  it('starts every front rank on an odd row of the board, where the enemies stand', () => {
    for (const row of [...TUNING.levelRows, TUNING.endlessRow]) {
      expect(row.frontRow % 2).toBe(1);
      expect(row.frontRow).toBeLessThan(TUNING.rows - 1);
    }
  });

  it('picks the row rowFor picks for every level difficulty', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 99 }), (difficulty) => {
        expect(knobsFor(difficulty)).toBe(
          TUNING.levelRows[rowFor(difficulty, TUNING.levelRows.length)],
        );
      }),
    );
  });
});

describe('chainPoints', () => {
  it('gives the n-th jump of a chain n x jumpPoints', () => {
    expect([1, 2, 3, 4].map((jumps) => chainPoints(jumps))).toStrictEqual(GOLDEN_CHAIN_POINTS);
  });

  it('grows faster than the number of jumps (long chains pay more per enemy)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), (jumps) => {
        expect(chainPoints(jumps + 1) - chainPoints(jumps)).toBe((jumps + 1) * TUNING.jumpPoints);
      }),
    );
  });
});

const GOLDEN_CHAIN_POINTS = [10, 30, 60, 100];
