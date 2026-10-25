// apps/jump-chain/src/rules/ranks.test.ts
import fc from 'fast-check';

import { seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { makeRank } from './ranks.ts';

import type { Enemy } from './jump-chain-types.ts';

const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });

/** 1 to 3 enemies of rank 1 on row 3's inner dark squares, with consecutive ids from 4. */
function expectInnerRank(enemies: readonly Enemy[]): void {
  expect(enemies.length).toBeGreaterThanOrEqual(1);
  expect(enemies.length).toBeLessThanOrEqual(3);
  expect(enemies.map((enemy) => enemy.id)).toStrictEqual(enemies.map((_, index) => 4 + index));
  expect(enemies.every((enemy) => enemy.rank === 1 && enemy.row === 3)).toBe(true);
  expect(enemies.every((enemy) => [1, 3, 5].includes(enemy.col))).toBe(true);
}

describe('makeRank', () => {
  it('keeps the pinned rank for seed 1 at a 50 % fill (a changed rank breaks saved levels)', () => {
    const made = makeRank({ rng: seedRng(1), rank: 2, row: 1, fill: 50, firstId: 7 });
    expect(made.enemies).toStrictEqual(GOLDEN_SEED_1_RANK);
  });

  it('fills every inner square of the row at a 100 % fill, left to right', () => {
    const made = makeRank({ rng: seedRng(3), rank: 0, row: 5, fill: 100, firstId: 0 });
    expect(made.enemies.map((enemy) => [enemy.id, enemy.col, enemy.row])).toStrictEqual([
      [0, 1, 5],
      [1, 3, 5],
      [2, 5, 5],
    ]);
  });

  it('places one enemy even at a 0 % fill: a rank is never empty', () => {
    const made = makeRank({ rng: seedRng(3), rank: 4, row: -1, fill: 0, firstId: 9 });
    expect(made.enemies).toHaveLength(1);
    expect(made.enemies[0]).toMatchObject({ id: 9, rank: 4, row: -1 });
  });

  it('places 1 to 3 enemies on the inner dark squares of the row, with consecutive ids', () => {
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 0, max: 100 }), (seed, fill) => {
        expectInnerRank(
          makeRank({ rng: seedRng(seed), rank: 1, row: 3, fill, firstId: 4 }).enemies,
        );
      }),
    );
  });

  it('draws the same rank from the same RNG state and moves the RNG on', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const request = { rng: seedRng(seed), rank: 0, row: 5, fill: 70, firstId: 0 };
        expect(makeRank(request)).toStrictEqual(makeRank(request));
        expect(makeRank(request).rng).not.toStrictEqual(request.rng);
      }),
    );
  });
});

const GOLDEN_SEED_1_RANK = [
  { id: 7, rank: 2, col: 1, row: 1 },
  { id: 8, rank: 2, col: 5, row: 1 },
];
