// apps/swap-guard/src/rules/swap-guard-tuning.test.ts
import fc from 'fast-check';

import { TUNING, knobsFor, volleyPoints } from './swap-guard-tuning.ts';

describe('knobsFor (the difficulty rows on the 0..100 scale)', () => {
  it('returns the row whose lower bound is the largest at or below the difficulty', () => {
    expect(knobsFor(0)).toBe(TUNING.levelRows[0]);
    expect(knobsFor(24)).toBe(TUNING.levelRows[0]);
    expect(knobsFor(25)).toBe(TUNING.levelRows[1]);
    expect(knobsFor(49)).toBe(TUNING.levelRows[1]);
    expect(knobsFor(50)).toBe(TUNING.levelRows[2]);
    expect(knobsFor(75)).toBe(TUNING.levelRows[3]);
    expect(knobsFor(99)).toBe(TUNING.levelRows[3]);
  });

  it('plays 100 and anything past the scale as the hardest row (no endless mode)', () => {
    expect(knobsFor(100)).toBe(TUNING.levelRows[3]);
    expect(knobsFor(400)).toBe(TUNING.levelRows[3]);
    expect(knobsFor(-5)).toBe(TUNING.levelRows[0]);
  });

  it('keeps every later row at least as hard: a board as large, as many enemies and kinds', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 98 }), (difficulty) => {
        const now = knobsFor(difficulty);
        const next = knobsFor(difficulty + 1);
        expect(next.size).toBeGreaterThanOrEqual(now.size);
        expect(next.enemies).toBeGreaterThanOrEqual(now.enemies);
        expect(next.kinds.length).toBeGreaterThanOrEqual(now.kinds.length);
      }),
    );
  });

  it('gives the harder rows at most 3 swaps per enemy (the budgets the sims measured)', () => {
    for (const row of TUNING.levelRows.slice(1)) {
      expect(row.maxSwaps / row.enemies).toBeLessThanOrEqual(3);
    }
  });

  it('brings in one enemy kind per row: spears, then archers, then brutes', () => {
    expect(TUNING.levelRows.map((row) => row.kinds)).toStrictEqual([
      ['spear'],
      ['spear', 'archer'],
      ['spear', 'archer', 'brute'],
      ['spear', 'archer', 'brute'],
    ]);
  });

  it('opens every row with a spear (the opening threat is a spear)', () => {
    for (const row of TUNING.levelRows) expect(row.kinds).toContain('spear');
  });
});

describe('volleyPoints', () => {
  it('gives nothing for a volley that knocks nobody out', () => {
    expect(volleyPoints(0)).toBe(0);
  });

  it('gives 100 per enemy and 50 more per extra enemy in the same volley', () => {
    expect(volleyPoints(1)).toBe(100);
    expect(volleyPoints(2)).toBe(GOLDEN_DOUBLE_HIT_POINTS);
    expect(volleyPoints(3)).toBe(400);
  });
});

const GOLDEN_DOUBLE_HIT_POINTS = 250;
