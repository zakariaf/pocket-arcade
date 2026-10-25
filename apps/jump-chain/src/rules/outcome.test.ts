// apps/jump-chain/src/rules/outcome.test.ts
import fc from 'fast-check';

import { ENDLESS_DIFFICULTY } from '@e07/game-kit/contract/difficulty.ts';

import { create } from './create.ts';
import { OVERRUN_KEY, isLevelCleared, outcome } from './outcome.ts';

const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });

describe('outcome', () => {
  it('reports playing while enemies remain and none has reached your side', () => {
    expect(outcome(create(1, 0))).toStrictEqual({ kind: 'playing' });
  });

  it('reports a win with the score once every enemy of a level is captured', () => {
    const cleared = { ...create(1, 0), enemies: [], score: 230 };
    expect(outcome(cleared)).toStrictEqual({ kind: 'won', score: 230 });
  });

  it('reports the overrun with its catalog key when an enemy reaches your side (row 9)', () => {
    const start = create(1, 0);
    const overrun = { ...start, enemies: [{ id: 0, rank: 0, col: 3, row: 9 }] };
    expect(outcome(overrun)).toStrictEqual({ kind: 'lost', reasonKey: OVERRUN_KEY });
    expect(OVERRUN_KEY).toBe('jump-chain.lose.overrun');
  });

  it('keeps an enemy one row short of your side in play', () => {
    const close = { ...create(1, 0), enemies: [{ id: 0, rank: 0, col: 3, row: 7 }] };
    expect(outcome(close).kind).toBe('playing');
  });

  it('keeps the endless run in play even with no enemy on the board (it is never won)', () => {
    const empty = { ...create(1, ENDLESS_DIFFICULTY), enemies: [] };
    expect(isLevelCleared(empty)).toBe(false);
    expect(outcome(empty).kind).toBe('playing');
  });

  it('counts a level as cleared only when no enemy is left, waiting ranks included', () => {
    const waiting = { ...create(1, 90), enemies: [{ id: 0, rank: 5, col: 3, row: -3 }] };
    expect(isLevelCleared(waiting)).toBe(false);
  });

  it('wins only with a whole, non-negative score', () => {
    fc.assert(
      fc.property(seedArb, fc.nat({ max: 5000 }), (seed, score) => {
        const result = outcome({ ...create(seed, 20), enemies: [], score });
        expect(result).toStrictEqual({ kind: 'won', score });
      }),
    );
  });
});
