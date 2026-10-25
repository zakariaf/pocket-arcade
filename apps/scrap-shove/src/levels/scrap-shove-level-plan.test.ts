// apps/scrap-shove/src/levels/scrap-shove-level-plan.test.ts
import { stateFromText } from '@e07/scrap-shove/rules/board-text.ts';

import {
  difficultyFor,
  LEVEL_DIFFICULTY_CAP,
  LEVELS_PER_PACK,
  minParFor,
  randomWins,
  RANDOM_TRIES,
  SCRAP_SHOVE_LEVEL_PLAN,
} from './scrap-shove-level-plan.ts';

const LEVELS = Array.from({ length: 3 * LEVELS_PER_PACK }, (_, index) => index + 1);

/** Whatever the player taps, the lone robot's next step lands on the heap: every game is won. */
const DOOMED = stateFromText([
  'n.......',
  '.#......',
  '........',
  '........',
  '....@...',
  '........',
  '........',
  '........',
]);

describe('difficultyFor', () => {
  it('rises from 0 at level 1 to 99 at level 90 without ever falling (spec 8.1, D9)', () => {
    const curve = LEVELS.map(difficultyFor);
    expect(curve[0]).toBe(0);
    expect(curve.at(-1)).toBe(LEVEL_DIFFICULTY_CAP);
    expect(LEVEL_DIFFICULTY_CAP).toBe(99);
    expect(curve).toStrictEqual([...curve].sort((a, b) => a - b));
  });

  it('clamps level numbers outside the table', () => {
    expect(difficultyFor(0)).toBe(0);
    expect(difficultyFor(500)).toBe(LEVEL_DIFFICULTY_CAP);
  });
});

describe('randomWins', () => {
  it('counts how many random tap games win the floor', () => {
    expect(randomWins(DOOMED)).toBe(RANDOM_TRIES);
    expect(randomWins(stateFromText(['h..', '...', '..@']))).toBe(0);
  });
});

describe('SCRAP_SHOVE_LEVEL_PLAN', () => {
  it('asks more moves in later packs: 2, 3, then 4', () => {
    expect([1, 30, 31, 60, 61, 90].map(minParFor)).toStrictEqual([2, 2, 3, 3, 4, 4]);
  });

  it('rates a level against par and rejects one too easy for its pack', () => {
    const start = SCRAP_SHOVE_LEVEL_PLAN.create(1, 40);
    const candidate = { level: 61, seed: 1, difficulty: 40, start, line: [], final: start };
    expect(SCRAP_SHOVE_LEVEL_PLAN.rate({ ...candidate, par: 5 })).toStrictEqual({
      kind: 'par',
      par: 5,
    });
    expect(SCRAP_SHOVE_LEVEL_PLAN.rate({ ...candidate, par: 3 })).toBeNull();
  });

  it('rejects a floor that random taps win too often (naive bots should lose)', () => {
    const candidate = {
      level: 1,
      seed: 1,
      difficulty: 0,
      start: DOOMED,
      line: [],
      final: DOOMED,
      par: 2,
    };
    expect(SCRAP_SHOVE_LEVEL_PLAN.rate(candidate)).toBeNull();
  });

  it('declares three packs of thirty levels with the copy deck pack names', () => {
    expect(SCRAP_SHOVE_LEVEL_PLAN.packs.map((pack) => pack.nameId)).toStrictEqual([
      'scrap-shove.pack-name.1',
      'scrap-shove.pack-name.2',
      'scrap-shove.pack-name.3',
    ]);
    expect(SCRAP_SHOVE_LEVEL_PLAN.levelsPerPack).toBe(30);
  });
});
