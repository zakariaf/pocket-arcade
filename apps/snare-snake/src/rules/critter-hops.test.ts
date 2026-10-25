// apps/snare-snake/src/rules/critter-hops.test.ts
// The design fix (design notes): critters keep away from the snake and freeze when it is next to
// them, so they no longer slip out while a loop is drawn.
import fc from 'fast-check';

import { seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { touchingCells } from './board-grid.ts';
import { create } from './create.ts';
import { hopCritters } from './critter-hops.ts';

import type { SnareSnakeState } from './snare-snake-types.ts';

const at = (col: number, row: number): number => row * 7 + col;

function withCritters(cells: readonly number[], seed = 1): SnareSnakeState {
  return {
    ...create(1, 0),
    snake: [at(1, 1), at(2, 1), at(3, 1)],
    critters: cells.map((cell, id) => ({ id, cell })),
    rng: seedRng(seed),
  };
}

describe('hopCritters', () => {
  it('freezes a critter next to the snake and draws nothing for it', () => {
    const state = withCritters([at(1, 2)]);
    expect(hopCritters(state)).toStrictEqual({
      critters: state.critters,
      hops: [],
      rng: state.rng,
    });
  });

  it('lets a free critter hop one cell, drawing its direction from the run', () => {
    const result = hopCritters(withCritters([at(4, 5)]));
    expect(result.hops).toStrictEqual(GOLDEN_SEED_1_HOPS);
    expect(result.rng).not.toStrictEqual(seedRng(1));
  });

  it('keeps every hop off and away from the snake, off other critters and on the board (property)', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        fc.uniqueArray(fc.integer({ min: 21, max: 55 }), { minLength: 1, maxLength: 12 }),
        (seed, cells) => {
          const state = withCritters(cells, seed);
          const near = touchingCells(state, state.snake);
          const result = hopCritters(state);
          const after = result.critters.map((critter) => critter.cell);
          expect(new Set(after).size).toBe(after.length);
          for (const hop of result.hops) {
            expect(near.has(hop.to)).toBe(false);
            expect(state.snake).not.toContain(hop.to);
            expect(hop.to).toBeGreaterThanOrEqual(0);
            expect(hop.to).toBeLessThan(56);
          }
        },
      ),
    );
  });
});

const GOLDEN_SEED_1_HOPS = [{ critterId: 0, from: 39, to: 38 }];
