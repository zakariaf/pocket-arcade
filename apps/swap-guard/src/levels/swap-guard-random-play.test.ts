// apps/swap-guard/src/levels/swap-guard-random-play.test.ts
import fc from 'fast-check';

import { create } from '@e07/swap-guard/rules/create.ts';

import { randomWins } from './swap-guard-random-play.ts';

import type { SwapGuardState } from '@e07/swap-guard/rules/swap-guard-types.ts';

function board(
  guard: number,
  enemies: SwapGuardState['enemies'],
  maxSwaps: number,
): SwapGuardState {
  return {
    size: 5,
    guard,
    enemies,
    enemyCount: enemies.length,
    swaps: 0,
    maxSwaps,
    score: 0,
    isHit: false,
    lastSwap: null,
    hasContinued: false,
  };
}

describe('randomWins (naive players should lose a level)', () => {
  it('counts every run as won on a board with no enemy left', () => {
    expect(randomWins(board(12, [], 4), 7, 20)).toBe(20);
  });

  it('counts no run as won when no swap is left', () => {
    expect(randomWins(board(12, [{ id: 0, kind: 'spear', facing: 'up', cell: 0 }], 0), 7, 20)).toBe(
      0,
    );
  });

  it('pins the random wins of seed 1 at difficulty 0 over 20 runs', () => {
    expect(randomWins(create(1, 0), 1, 20)).toBe(0);
  });

  it('gives the same count for the same start and seed, between 0 and the runs', () => {
    fc.assert(
      fc.property(fc.nat(), fc.integer({ min: 0, max: 49 }), (seed, difficulty) => {
        const start = create(seed, difficulty);
        const wins = randomWins(start, seed, 5);
        expect(randomWins(start, seed, 5)).toBe(wins);
        expect(wins).toBeGreaterThanOrEqual(0);
        expect(wins).toBeLessThanOrEqual(5);
      }),
      { seed: 31, numRuns: 20 },
    );
  });
});
