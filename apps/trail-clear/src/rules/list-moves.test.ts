// apps/trail-clear/src/rules/list-moves.test.ts
// Spec 10 RULES: "The list of moves allowed in a state." Every cell and turn where the offered
// tile's edges match its neighbours (the rim counts as grass), each placement once, in board order.
import fc from 'fast-check';

import { ALL_CELLS, cellAt } from './board-cells.ts';
import { create } from './create.ts';
import { listMoves } from './list-moves.ts';
import { edgesOf } from './tiles.ts';
import { TUNING } from './trail-clear-tuning.ts';
import { fits } from './trails.ts';

import type { TrailClearMove, TrailClearState } from './trail-clear-types.ts';

const SIZE = TUNING.boardSize;
const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });

/** Every (cell, turn) where the offered tile fits, by brute force over all four turns. */
function placementsByHand(state: TrailClearState): string[] {
  const tile = state.offered;
  if (tile === null) return [];
  const found = ALL_CELLS.flatMap((cell) =>
    [0, 1, 2, 3]
      .filter((turns) => fits(state.cells, cell, edgesOf(tile, turns)))
      .map((turns) => `${String(cell)}:${edgesOf(tile, turns).join('')}`),
  );
  return [...new Set(found)].sort();
}

function placementsListed(state: TrailClearState): string[] {
  return listMoves(state)
    .map((move) => {
      const cell = cellAt(move.col, move.row);
      return `${String(cell)}:${edgesOf(state.offered ?? 'road-end', move.turns).join('')}`;
    })
    .sort();
}

describe('listMoves', () => {
  it('offers the ford in the opening gap, turned to face the road end', () => {
    const state = create(1, 0);
    const moves = listMoves(state);
    expect(moves).toContainEqual(GOLDEN_SEED_1_DOUBLE_MOVE);
    expect(moves).toHaveLength(GOLDEN_SEED_1_MOVE_COUNT);
  });

  it('lists the placements row by row, then column by column, then turn by turn', () => {
    const moves = listMoves(create(1, 0));
    const order = moves.map((move) => (move.row * SIZE + move.col) * 4 + move.turns);
    expect(order).toStrictEqual([...order].sort((a, b) => a - b));
  });

  it('lists nothing once the bag is empty', () => {
    expect(listMoves({ ...create(1, 0), offered: null })).toStrictEqual([]);
  });

  it('lists nothing when the offered tile fits nowhere', () => {
    const full = create(1, 0).cells.map(
      (tile) => tile ?? { kind: 'road-end' as const, turns: 0, placedAt: 1 },
    );
    expect(listMoves({ ...create(1, 0), cells: full })).toStrictEqual([]);
  });

  describe('properties', () => {
    it('lists exactly the placements that fit, each one once', () => {
      fc.assert(
        fc.property(seedArb, fc.integer({ min: 0, max: 100 }), (seed, difficulty) => {
          const state = create(seed, difficulty);
          const listed = placementsListed(state);
          expect(listed).toStrictEqual(placementsByHand(state));
          expect(new Set(listed).size).toBe(listed.length);
        }),
      );
    });
  });
});

const GOLDEN_SEED_1_DOUBLE_MOVE: TrailClearMove = { kind: 'place-tile', turns: 1, col: 3, row: 2 };
const GOLDEN_SEED_1_MOVE_COUNT = 41;
