// apps/jump-chain/src/rules/tutorial-board.test.ts
// Spec S13: the tutorial board is small and fixed, on seed 1's level-0 layout.
import fc from 'fast-check';

import { createLayout } from './create.ts';
import { TUTORIAL_START, tutorialPosition } from './tutorial-board.ts';

describe('TUTORIAL_START', () => {
  it('stands two front enemies on the left and one more waiting above the board', () => {
    expect(TUTORIAL_START).toStrictEqual({
      ...createLayout(1, 0),
      piece: { col: 3, row: 7 },
      enemies: [
        { id: 0, rank: 0, col: 1, row: 5 },
        { id: 1, rank: 0, col: 1, row: 3 },
        { id: 2, rank: 1, col: 3, row: -1 },
      ],
      total: 3,
      nextId: 3,
      nextRank: 2,
      marchIn: 3,
    });
  });
});

describe('tutorialPosition', () => {
  it('numbers the enemies in order and makes exactly the ranks they stand in', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.nat({ max: 6 }), fc.nat({ max: 9 }), fc.nat({ max: 3 })), {
          maxLength: 6,
        }),
        (squares) => {
          const state = tutorialPosition({ col: 3, row: 7 }, squares);
          expect(state.enemies.map((enemy) => enemy.id)).toStrictEqual(squares.map((_, id) => id));
          expect(state.total).toBe(squares.length);
          expect(state.nextId).toBe(squares.length);
          expect(state.nextRank).toBe(new Set(squares.map(([, , rank]) => rank)).size);
          expect(state.difficulty).toBe(0);
        },
      ),
    );
  });
});
