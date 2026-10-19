// apps/flock-tilt/src/rules/flock-tilt-tuning.test.ts
import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';

import { TUNING, knobsFor } from './flock-tilt-tuning.ts';

describe('knobsFor', () => {
  it('picks the row whose lower bound is the largest at or below the difficulty (0, 25, 50, 75)', () => {
    const sheep = [0, 24, 25, 49, 50, 74, 75, 99].map((difficulty) => knobsFor(difficulty).sheep);
    expect(sheep).toStrictEqual([3, 3, 4, 4, 5, 5, 6, 6]);
  });

  it('clamps difficulties outside the scale to the first and the last row', () => {
    expect(knobsFor(-5)).toStrictEqual(TUNING.levelRows[0]);
    expect(knobsFor(ENDLESS_DIFFICULTY)).toStrictEqual(TUNING.levelRows.at(-1));
  });

  it('adds sheep row by row and a second wolf in the hardest row', () => {
    const rows = TUNING.levelRows;
    const steps = rows.slice(1).map((row, index) => ({ row, previous: rows[index] ?? row }));
    for (const { row, previous } of steps) {
      expect(row.sheep).toBeGreaterThan(previous.sheep);
      expect(row.wolves).toBeGreaterThanOrEqual(previous.wolves);
      expect(row.minPar).toBeGreaterThan(previous.minPar);
    }
    expect(rows.map((row) => row.wolves)).toStrictEqual([1, 1, 1, 2]);
  });

  it('keeps every row inside the field: 2 to 6 sheep, 1 or 2 wolves, a par band of 3 to 8 tilts', () => {
    for (const row of TUNING.levelRows) {
      expect(row.sheep).toBeGreaterThanOrEqual(2);
      expect(row.sheep).toBeLessThanOrEqual(6);
      expect([1, 2]).toContain(row.wolves);
      expect(row.minRocks).toBeLessThanOrEqual(row.maxRocks);
      expect(row.minPar).toBeGreaterThanOrEqual(3);
      expect(row.maxPar).toBeLessThanOrEqual(8);
      expect(row.minPar).toBeLessThanOrEqual(row.maxPar);
    }
  });

  it('asks every field to need one sheep to stop against another (the twist, at once)', () => {
    expect(TUNING.minSheepBlocks).toBe(1);
  });

  it('gives a tilt budget far above the largest par (undo gives tilts back)', () => {
    const largestPar = Math.max(...TUNING.levelRows.map((row) => row.maxPar));
    expect(TUNING.tiltLimit).toBe(40);
    expect(TUNING.tiltLimit).toBeGreaterThanOrEqual(largestPar * 5);
  });
});
