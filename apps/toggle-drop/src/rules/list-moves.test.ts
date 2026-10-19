// apps/toggle-drop/src/rules/list-moves.test.ts
import fc from 'fast-check';

import { create } from './create.ts';
import { listMoves } from './list-moves.ts';

const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });
const difficultyArb = fc.integer({ min: 0, max: 99 });

describe('listMoves', () => {
  // Catalogue: "Tap a column to drop a ball"; spec 10: the list of moves allowed in a state.
  it('lists a drop in every column, left to right, while balls are left', () => {
    expect(listMoves(create(1, 0))).toStrictEqual(GOLDEN_SEED_1_MOVES);
  });

  it('lists none when the balls are spent', () => {
    expect(listMoves({ ...create(1, 0), ballsLeft: 0 })).toStrictEqual([]);
  });

  it('lists none when every cup is full', () => {
    const state = create(1, 0);
    expect(listMoves({ ...state, filled: state.needs })).toStrictEqual([]);
  });

  it('lists every column exactly once (property)', () => {
    fc.assert(
      fc.property(seedArb, difficultyArb, (seed, difficulty) => {
        const state = create(seed, difficulty);
        const cols = listMoves(state).map((move) => move.col);
        expect(cols).toStrictEqual(Array.from({ length: state.cols }, (_, col) => col));
      }),
    );
  });
});

const GOLDEN_SEED_1_MOVES = [0, 1, 2, 3, 4].map((col) => ({ kind: 'drop', col }));
