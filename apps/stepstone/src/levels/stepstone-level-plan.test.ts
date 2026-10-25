// apps/stepstone/src/levels/stepstone-level-plan.test.ts
// Spec 8.1: levels rise in difficulty, each solver-checked with its par; naive play should lose.
import { pondFromText } from '@e07/stepstone/rules/pond-text.ts';

import {
  difficultyFor,
  LEVELS_PER_PACK,
  MAX_RANDOM_CROSSINGS,
  minParFor,
  RANDOM_WALKS,
  randomCrossings,
  STEPSTONE_LEVEL_PLAN,
} from './stepstone-level-plan.ts';

import type { StepstoneState } from '@e07/stepstone/rules/stepstone-types.ts';

const LEVELS = Array.from({ length: 3 * LEVELS_PER_PACK }, (_, index) => index + 1);

function pond(text: string): StepstoneState {
  return { ...pondFromText(text), moves: 0, par: 2, kindsUsed: ['rook'] };
}

/** Only one hop at each stone: rook to the rook at 20, then along row 4 to the flag. */
const FORCED = pond(['r....', '.....', '.....', '.....', 'R...F'].join('\n'));
/** The rook at 0 reaches a king that strands the frog and a rook that reaches the flag. */
const FORK = pond(['r...K', '.....', 'R...F', '.....', '.....'].join('\n'));

function candidate(start: StepstoneState, level: number, par: number) {
  return { level, seed: 1, difficulty: difficultyFor(level), start, par, line: [], final: start };
}

describe('difficultyFor', () => {
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

describe('minParFor', () => {
  it("asks each tuning row's fewest hops: 3, 4, 5, then 6", () => {
    expect([1, 23, 24, 45, 46, 68, 69, 90].map(minParFor)).toStrictEqual([3, 3, 4, 4, 5, 5, 6, 6]);
  });

  it('asks at least the 2, 3 and 4 hops of a puzzle plan in the three packs', () => {
    LEVELS.forEach((level) => {
      expect(minParFor(level)).toBeGreaterThanOrEqual(
        2 + Math.floor((level - 1) / LEVELS_PER_PACK),
      );
    });
  });
});

describe('randomCrossings', () => {
  it('counts every random player across a pond with one hop at each stone', () => {
    expect(randomCrossings(FORCED)).toBe(RANDOM_WALKS);
  });

  it('strands some random players where one of two hops strands the frog', () => {
    expect(randomCrossings(FORK)).toBe(GOLDEN_FORK_CROSSINGS);
  });
});

describe('STEPSTONE_LEVEL_PLAN', () => {
  it('rates a level against par when it needs its fewest hops and random play strands', () => {
    expect(STEPSTONE_LEVEL_PLAN.rate(candidate(FORK, 1, 3))).toStrictEqual({ kind: 'par', par: 3 });
  });

  it('rejects a level too short for its row', () => {
    expect(STEPSTONE_LEVEL_PLAN.rate(candidate(FORK, 61, 4))).toBeNull();
  });

  it('rejects a level a random player crosses too often (naive play should lose)', () => {
    expect(randomCrossings(FORCED)).toBeGreaterThan(MAX_RANDOM_CROSSINGS);
    expect(STEPSTONE_LEVEL_PLAN.rate(candidate(FORCED, 1, 3))).toBeNull();
  });

  it('declares three packs of thirty levels', () => {
    expect(STEPSTONE_LEVEL_PLAN.packs.map((pack) => pack.id)).toStrictEqual([
      'lily-pond',
      'misty-creek',
      'river-rapids',
    ]);
    expect(STEPSTONE_LEVEL_PLAN.levelsPerPack).toBe(30);
  });
});

/** Seeded walks 1..16 on FORK: 4 draw the rook first and cross; the other 12 take the king. */
const GOLDEN_FORK_CROSSINGS = 4;
