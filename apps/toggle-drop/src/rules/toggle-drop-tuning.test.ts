// apps/toggle-drop/src/rules/toggle-drop-tuning.test.ts
import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';

import { TUNING, knobsFor } from './toggle-drop-tuning.ts';

/** The row index knobsFor picked (the table's rows are the only knob objects there are). */
function rowOf(difficulty: number): number {
  return TUNING.levelRows.findIndex((row) => row === knobsFor(difficulty));
}

describe('knobsFor', () => {
  // Spec 8.1: levels come from a seed plus a difficulty; the tuning row follows the difficulty.
  it('returns the row whose lower bound is the largest at or below the difficulty', () => {
    const rows = [0, 24, 25, 49, 50, 74, 75, 99].map(rowOf);
    expect(rows).toStrictEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it('clamps difficulties outside the scale to the first and the last row', () => {
    expect(rowOf(-5)).toBe(0);
    expect(rowOf(ENDLESS_DIFFICULTY)).toBe(3);
  });

  it('keeps the pinned easiest row (a changed row changes every shipped level)', () => {
    expect(knobsFor(0)).toStrictEqual(GOLDEN_EASIEST_ROW);
  });

  it('makes every row at least as big as the one before', () => {
    const keys = ['cols', 'rows', 'switchesPerRow', 'cups', 'witnessDrops'] as const;
    TUNING.levelRows.forEach((row, index) => {
      const previous = TUNING.levelRows[index - 1] ?? row;
      for (const key of keys) expect(row[key]).toBeGreaterThanOrEqual(previous[key]);
    });
  });

  it('gives every row a board its winning line can fill, with balls to spare', () => {
    for (const row of TUNING.levelRows) {
      expect(row.switchesPerRow).toBeLessThanOrEqual(row.cols);
      expect(row.cups).toBeLessThanOrEqual(Math.min(row.cols, row.witnessDrops));
      expect(row.spareBalls).toBeGreaterThanOrEqual(1);
    }
  });
});

const GOLDEN_EASIEST_ROW = {
  cols: 5,
  rows: 3,
  switchesPerRow: 2,
  cups: 2,
  witnessDrops: 2,
  spareBalls: 4,
};
