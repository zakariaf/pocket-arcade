// apps/toggle-drop/src/levels/toggle-drop-level-plan.test.ts
import { create } from '@e07/toggle-drop/rules/create.ts';

import {
  LEVELS_PER_PACK,
  TOGGLE_DROP_LEVEL_PLAN,
  difficultyFor,
  maxRandomShareFor,
  minParFor,
  randomShare,
} from './toggle-drop-level-plan.ts';

import type { ToggleDropState } from '@e07/toggle-drop/rules/toggle-drop-types.ts';

const LEVELS = Array.from({ length: 3 * LEVELS_PER_PACK }, (_, index) => index + 1);

/** Two columns whose switches send each ball across and flip: any two drops fill both cups. */
const ANY_DROP_WINS: ToggleDropState = {
  cols: 2,
  rows: 1,
  pegs: [1, 0],
  flips: [0, 0],
  needs: [1, 1],
  filled: [0, 0],
  ballsLeft: 2,
  drops: 0,
};

describe('difficultyFor', () => {
  // Spec 8.1: levels come from a seed plus a difficulty, rising through the packs.
  it('rises from 0 at level 1 to 99 at the last level without ever falling', () => {
    const curve = LEVELS.map(difficultyFor);
    expect(curve[0]).toBe(0);
    expect(curve.at(-1)).toBe(99);
    expect(curve).toStrictEqual([...curve].sort((a, b) => a - b));
  });

  it('clamps level numbers outside the table', () => {
    expect(difficultyFor(0)).toBe(0);
    expect(difficultyFor(500)).toBe(99);
  });
});

describe('randomShare', () => {
  it('counts the seeded random playouts that win the board', () => {
    expect(randomShare(ANY_DROP_WINS)).toBe(1);
    expect(randomShare({ ...ANY_DROP_WINS, needs: [2, 0], ballsLeft: 1 })).toBe(0);
  });

  it('gives the same share for the same board', () => {
    expect(randomShare(create(9, 50))).toBe(randomShare(create(9, 50)));
  });
});

describe('TOGGLE_DROP_LEVEL_PLAN', () => {
  it('asks more drops in later packs: 2, 3, then 4', () => {
    expect([1, 30, 31, 60, 61, 90].map(minParFor)).toStrictEqual([2, 2, 3, 3, 4, 4]);
  });

  it('lets random drops win less in later packs', () => {
    expect([1, 31, 61].map(maxRandomShareFor)).toStrictEqual([0.75, 0.5, 0.375]);
  });

  it('rates a level against par and rejects one too short for its pack', () => {
    const start = create(1, 80);
    const candidate = { level: 61, seed: 1, difficulty: 80, start, line: [], final: start };
    const share = randomShare(start);
    expect(share).toBeLessThanOrEqual(maxRandomShareFor(61));
    expect(TOGGLE_DROP_LEVEL_PLAN.rate({ ...candidate, par: 5 })).toStrictEqual({
      kind: 'par',
      par: 5,
    });
    expect(TOGGLE_DROP_LEVEL_PLAN.rate({ ...candidate, par: 3 })).toBeNull();
  });

  it('rejects a board that random drops win too often (naive play should lose)', () => {
    const candidate = { level: 1, seed: 1, difficulty: 0, start: ANY_DROP_WINS, line: [] };
    expect(TOGGLE_DROP_LEVEL_PLAN.rate({ ...candidate, par: 2, final: ANY_DROP_WINS })).toBeNull();
  });

  it('declares three packs of thirty levels', () => {
    expect(TOGGLE_DROP_LEVEL_PLAN.packs.map((pack) => pack.nameId)).toStrictEqual([
      'toggle-drop.pack-name.1',
      'toggle-drop.pack-name.2',
      'toggle-drop.pack-name.3',
    ]);
    expect(TOGGLE_DROP_LEVEL_PLAN.levelsPerPack).toBe(30);
  });
});
