// apps/merge-siege/src/rules/opening.test.ts
// The prepared opening (design notes, the design fix item 4): the first swipe up smashes two
// enemies at once, the first payoff and the twist of game-balance-and-bots' kill test in move 1.
import fc from 'fast-check';

import { seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { COLS, cellAt } from './board-cells.ts';
import { drawOpening, openingCells } from './opening.ts';

const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });

describe('drawOpening', () => {
  it('keeps the pinned columns for seed 1', () => {
    expect(drawOpening(seedRng(1)).opening).toStrictEqual(GOLDEN_SEED_1_OPENING);
  });

  it('picks three different columns of the board for any seed', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const { first, second, spare } = drawOpening(seedRng(seed)).opening;
        expect(new Set([first, second, spare]).size).toBe(3);
        for (const col of [first, second, spare]) {
          expect(col).toBeGreaterThanOrEqual(0);
          expect(col).toBeLessThan(COLS);
        }
      }),
    );
  });
});

describe('openingCells', () => {
  it('places two 2-enemies in rows 1 and 2 above a 2 of the player each, and a 4', () => {
    const { cells, enemies, nextId } = openingCells({ first: 1, second: 3, spare: 0 });
    expect(cells[cellAt(1, 1)]).toStrictEqual({ id: 1, kind: 'enemy', value: 2 });
    expect(cells[cellAt(3, 2)]).toStrictEqual({ id: 2, kind: 'enemy', value: 2 });
    expect(cells[cellAt(1, 4)]).toStrictEqual({ id: 3, kind: 'tile', value: 2 });
    expect(cells[cellAt(3, 5)]).toStrictEqual({ id: 4, kind: 'tile', value: 2 });
    expect(cells[cellAt(0, 5)]).toStrictEqual({ id: 5, kind: 'tile', value: 4 });
    expect(cells.filter((cell) => cell !== null)).toHaveLength(5);
    expect({ enemies, nextId }).toStrictEqual({ enemies: 2, nextId: 6 });
  });
});

const GOLDEN_SEED_1_OPENING = { first: 2, second: 1, spare: 4 };
