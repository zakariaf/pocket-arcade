// apps/merge-siege/src/rules/merge-siege-tuning.test.ts
// Turn-based Merge Siege (design notes, classification): every balance number on the one 0..100
// difficulty scale, picked by rowFor; difficulty 100 is the endless run, never won.
import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';

import { ENEMY_VALUES, TUNING, knobsFor } from './merge-siege-tuning.ts';

/** The weighted mean of the numbers a row's entering enemies carry. */
function meanEnemy(weights: readonly number[]): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return (
    weights.reduce((sum, weight, index) => sum + weight * (ENEMY_VALUES[index] ?? 0), 0) / total
  );
}

describe('knobsFor (turn-based: the knobs of a difficulty)', () => {
  it('gives the endless row (goal 0, never won) at the endless difficulty', () => {
    expect(knobsFor(ENDLESS_DIFFICULTY)).toStrictEqual(TUNING.endlessRow);
    expect(knobsFor(ENDLESS_DIFFICULTY).goal).toBe(0);
  });

  it('maps the level scale 0..99 onto the four rows in equal bands, easiest first', () => {
    const goals = [0, 24, 25, 45, 49, 50, 74, 75, 99].map(
      (difficulty) => knobsFor(difficulty).goal,
    );
    expect(goals).toStrictEqual(GOLDEN_GOALS);
  });

  it('clamps difficulties below the scale to the easiest row', () => {
    expect(knobsFor(-7)).toStrictEqual(TUNING.levelRows[0]);
  });

  it('makes every harder row at least as hard: more enemies, a march as fast, bigger numbers', () => {
    const rows = TUNING.levelRows;
    rows.forEach((row, index) => {
      const previous = rows[index - 1] ?? row;
      expect(row.goal).toBeGreaterThanOrEqual(previous.goal);
      expect(row.marchEvery).toBeLessThanOrEqual(previous.marchEvery);
      expect(row.spawnEvery).toBeLessThanOrEqual(previous.spawnEvery);
      expect(meanEnemy(row.enemyWeights)).toBeGreaterThanOrEqual(meanEnemy(previous.enemyWeights));
    });
  });

  it('brings more than the two opening enemies in every level wave', () => {
    for (const row of TUNING.levelRows) expect(row.goal).toBeGreaterThan(2);
  });

  it('weighs exactly the enemy numbers 2 to 32', () => {
    expect(ENEMY_VALUES).toStrictEqual([2, 4, 8, 16, 32]);
    for (const row of [...TUNING.levelRows, TUNING.endlessRow]) {
      expect(row.enemyWeights).toHaveLength(ENEMY_VALUES.length);
    }
  });
});

const GOLDEN_GOALS = [8, 8, 14, 14, 14, 16, 16, 18, 18];
