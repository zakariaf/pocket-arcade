// apps/line-siege/src/rules/line-siege-tuning.test.ts
import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';

import { TUNING, knobsFor } from './line-siege-tuning.ts';

describe('knobsFor', () => {
  it('gives the endless row (goal 0, never won) at the endless difficulty', () => {
    expect(knobsFor(ENDLESS_DIFFICULTY)).toStrictEqual(TUNING.endlessRow);
    expect(knobsFor(ENDLESS_DIFFICULTY).goal).toBe(0);
  });

  it('maps the level scale 0..99 onto the four rows in equal bands, easiest first', () => {
    const goals = [0, 24, 25, 45, 49, 50, 74, 75, 99].map(
      (difficulty) => knobsFor(difficulty).goal,
    );
    expect(goals).toStrictEqual([4, 4, 5, 5, 5, 6, 6, 7, 7]);
  });

  it('clamps difficulties below the scale to the easiest row', () => {
    expect(knobsFor(-7)).toStrictEqual(TUNING.levelRows[0]);
  });

  it('keeps every harder row at least as hard in every knob (monotonic knobs)', () => {
    const rows = TUNING.levelRows;
    rows.forEach((row, index) => {
      const previous = rows[index - 1] ?? row;
      expect(row.goal).toBeGreaterThanOrEqual(previous.goal);
      expect(row.marchEvery).toBeLessThanOrEqual(previous.marchEvery);
      expect(row.spawnEvery).toBeLessThanOrEqual(previous.spawnEvery);
      expect(row.hpMax).toBeGreaterThanOrEqual(previous.hpMax);
    });
  });

  it('marches every 2 or more placements, so the teaching copy "every few blocks" stays true', () => {
    // The lead's L4 wording (2026-09-30): a marchEvery of 1 needs new copy from the owner first.
    for (const row of [...TUNING.levelRows, TUNING.endlessRow]) {
      expect(row.marchEvery).toBeGreaterThanOrEqual(2);
    }
  });
});
