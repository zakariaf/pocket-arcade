// apps/jump-chain/src/rules/move-ends.test.ts
// The input plays the move that ends on the square the finger chose (a drag's drop square or a
// tapped square): the longest listed chain that ends there, the first listed among equally long.
import fc from 'fast-check';

import { playChoices } from '@e07/game-kit/testing/play-choices.ts';

import { applyMove } from './apply-move.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { moveEndingAt, movesByEnd } from './move-ends.ts';

import type { JumpChainMove, JumpChainState, Square } from './jump-chain-types.ts';

function position(
  piece: Square,
  enemySquares: readonly (readonly [number, number])[],
): JumpChainState {
  const enemies = enemySquares.map(([col, row], id) => ({ id, rank: 0, col, row }));
  return { ...create(1, 0), piece, enemies, total: enemies.length, nextId: enemies.length };
}

function lastSquare(move: JumpChainMove): Square | undefined {
  return move.kind === 'step' ? move.to : move.path.at(-1);
}

/** Every move movesByEnd offers is listed, ends on its square, and no square appears twice. */
function expectEnds(state: JumpChainState): void {
  const ends = movesByEnd(state);
  const keys = ends.map((end) => `${String(end.square.col)},${String(end.square.row)}`);
  expect(new Set(keys).size).toBe(keys.length);
  for (const end of ends) {
    expect(listMoves(state)).toContainEqual(end.move);
    expect(lastSquare(end.move)).toStrictEqual(end.square);
  }
}

describe('moveEndingAt', () => {
  it('plays the longest chain that ends on the square', () => {
    const state = position({ col: 2, row: 6 }, [
      [1, 5],
      [3, 5],
      [1, 3],
      [3, 3],
      [5, 3],
    ]);
    expect(moveEndingAt(state, { col: 2, row: 6 })).toStrictEqual({
      kind: 'jump',
      path: [
        { col: 0, row: 4 },
        { col: 2, row: 2 },
        { col: 4, row: 4 },
        { col: 2, row: 6 },
      ],
    });
  });

  it('plays the first listed of two equally long chains (up-left before up-right)', () => {
    const state = position({ col: 2, row: 6 }, [
      [1, 5],
      [3, 5],
      [1, 3],
      [3, 3],
    ]);
    expect(moveEndingAt(state, { col: 2, row: 2 })).toStrictEqual({
      kind: 'jump',
      path: [
        { col: 0, row: 4 },
        { col: 2, row: 2 },
      ],
    });
  });

  it('plays a step onto a free neighbour, and nothing where no move ends', () => {
    const state = position({ col: 3, row: 7 }, [[3, 3]]);
    expect(moveEndingAt(state, { col: 2, row: 6 })).toStrictEqual({
      kind: 'step',
      to: { col: 2, row: 6 },
    });
    expect(moveEndingAt(state, { col: 3, row: 5 })).toBeNull();
  });
});

describe('movesByEnd', () => {
  it('lists each end square once, in the order its first move is listed', () => {
    const state = position({ col: 3, row: 7 }, [[3, 3]]);
    expect(movesByEnd(state).map((end) => end.square)).toStrictEqual(GOLDEN_START_ENDS);
  });

  it('offers only listed moves, each ending on its square, every square once', () => {
    fc.assert(
      fc.property(
        fc.nat(),
        fc.integer({ min: 0, max: 100 }),
        fc.array(fc.nat(), { maxLength: 20 }),
        (seed, difficulty, choices) => {
          for (const state of playChoices(
            { listMoves, applyMove },
            create(seed, difficulty),
            choices,
          ).states) {
            expectEnds(state);
          }
        },
      ),
      { numRuns: 40 },
    );
  });
});

const GOLDEN_START_ENDS = [
  { col: 2, row: 6 },
  { col: 4, row: 6 },
  { col: 2, row: 8 },
  { col: 4, row: 8 },
];
