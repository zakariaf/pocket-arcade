// apps/swap-guard/src/rules/outcome.test.ts
import fc from 'fast-check';

import { create } from './create.ts';
import { outcome } from './outcome.ts';

import type { Enemy, SwapGuardState } from './swap-guard-types.ts';

const SPEAR: Enemy = { id: 0, kind: 'spear', facing: 'up', cell: 0 };

function state(overrides: Partial<SwapGuardState>): SwapGuardState {
  return {
    size: 5,
    guard: 12,
    enemies: [SPEAR],
    enemyCount: 3,
    swaps: 4,
    maxSwaps: 12,
    score: 300,
    isHit: false,
    lastSwap: null,
    hasContinued: false,
    ...overrides,
  };
}

describe('outcome', () => {
  it('plays on while enemies stand and swaps are left', () => {
    expect(outcome(state({}))).toStrictEqual({ kind: 'playing' });
  });

  it('wins when every enemy is knocked out, with 10 points per spare swap', () => {
    expect(outcome(state({ enemies: [] }))).toStrictEqual({ kind: 'won', score: GOLDEN_WIN_SCORE });
  });

  it('wins with the last swap of the budget', () => {
    expect(outcome(state({ enemies: [], swaps: 12 }))).toStrictEqual({ kind: 'won', score: 300 });
  });

  it('loses when a strike lands on the guard (swap-guard.lose.hit)', () => {
    expect(outcome(state({ isHit: true }))).toStrictEqual({
      kind: 'lost',
      reasonKey: 'swap-guard.lose.hit',
    });
  });

  it('loses on a hit even when the same volley knocks out the last enemy', () => {
    expect(outcome(state({ isHit: true, enemies: [] })).kind).toBe('lost');
  });

  it('loses when the swaps run out with enemies left (swap-guard.lose.out-of-swaps)', () => {
    expect(outcome(state({ swaps: 12 }))).toStrictEqual({
      kind: 'lost',
      reasonKey: 'swap-guard.lose.out-of-swaps',
    });
  });

  describe('properties', () => {
    it('gives whole, non-negative win scores', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 12 }),
          fc.integer({ min: 0, max: 5000 }),
          (swaps, score) => {
            const result = outcome(state({ enemies: [], swaps, score }));
            if (result.kind !== 'won') throw new Error('an empty board must win');
            expect(Number.isInteger(result.score)).toBe(true);
            expect(result.score).toBeGreaterThanOrEqual(0);
          },
        ),
      );
    });

    it('keeps every fresh run playing', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 4_294_967_295 }),
          fc.integer({ min: 0, max: 100 }),
          (seed, difficulty) => {
            expect(outcome(create(seed, difficulty))).toStrictEqual({ kind: 'playing' });
          },
        ),
      );
    });
  });
});

const GOLDEN_WIN_SCORE = 380;
