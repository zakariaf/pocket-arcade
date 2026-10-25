// apps/swap-guard/src/levels/swap-guard-level-plan.test.ts
import { knobsFor } from '@e07/swap-guard/rules/swap-guard-tuning.ts';

import {
  difficultyFor,
  LEVEL_DIFFICULTY_CAP,
  LEVELS_PER_PACK,
  MAX_RANDOM_WINS,
  minParFor,
  RANDOM_RUNS,
  SWAP_GUARD_LEVEL_PLAN,
} from './swap-guard-level-plan.ts';
import { randomWins } from './swap-guard-random-play.ts';

const LEVELS = Array.from({ length: 3 * LEVELS_PER_PACK }, (_, index) => index + 1);

describe('difficultyFor (spec 8.1: a rising curve, no trivial level)', () => {
  it('rises from 0 at level 1 to the cap at the last level without ever falling', () => {
    const curve = LEVELS.map(difficultyFor);
    expect(curve[0]).toBe(0);
    expect(curve.at(-1)).toBe(LEVEL_DIFFICULTY_CAP);
    expect(curve).toStrictEqual([...curve].sort((a, b) => a - b));
  });

  it('plays one tuning row per pack: 5 x 5 spears, then archers, then 6 x 6 with brutes', () => {
    const rowOf = (level: number) => knobsFor(difficultyFor(level));
    expect([1, 30].map((level) => rowOf(level).kinds)).toStrictEqual([['spear'], ['spear']]);
    expect([31, 60].map((level) => rowOf(level).kinds.length)).toStrictEqual([2, 2]);
    expect([61, 90].map((level) => rowOf(level).size)).toStrictEqual([6, 6]);
  });

  it('pins the curve at the pack boundaries', () => {
    expect([1, 30, 31, 60, 61, 90].map(difficultyFor)).toStrictEqual([0, 24, 25, 49, 50, 74]);
  });

  it('clamps level numbers outside the table', () => {
    expect(difficultyFor(0)).toBe(0);
    expect(difficultyFor(500)).toBe(LEVEL_DIFFICULTY_CAP);
  });
});

describe('SWAP_GUARD_LEVEL_PLAN', () => {
  const start = SWAP_GUARD_LEVEL_PLAN.create(1, 0);
  const candidate = { level: 31, seed: 1, difficulty: 25, start, line: [], final: start };

  it('asks more swaps in later packs: 3, 5, then 8', () => {
    expect([1, 30, 31, 60, 61, 90].map(minParFor)).toStrictEqual([3, 3, 5, 5, 8, 8]);
  });

  it('rates a level against par and rejects one that is too easy for its pack', () => {
    expect(SWAP_GUARD_LEVEL_PLAN.rate({ ...candidate, par: 6 })).toStrictEqual({
      kind: 'par',
      par: 6,
    });
    expect(SWAP_GUARD_LEVEL_PLAN.rate({ ...candidate, par: 4 })).toBeNull();
  });

  it('rejects a level a random player wins too often', () => {
    const empty = { ...start, enemies: [], enemyCount: 0 };
    expect(randomWins(empty, 1, RANDOM_RUNS)).toBeGreaterThan(MAX_RANDOM_WINS);
    expect(SWAP_GUARD_LEVEL_PLAN.rate({ ...candidate, start: empty, par: 6 })).toBeNull();
  });

  it('declares three packs of thirty levels with the catalog pack names', () => {
    expect(SWAP_GUARD_LEVEL_PLAN.packs.map((pack) => pack.nameId)).toStrictEqual([
      'swap-guard.pack-name.1',
      'swap-guard.pack-name.2',
      'swap-guard.pack-name.3',
    ]);
    expect(SWAP_GUARD_LEVEL_PLAN.levelsPerPack).toBe(30);
  });
});
