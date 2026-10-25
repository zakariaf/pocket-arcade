// apps/trail-clear/src/rules/placement.test.ts
import fc from 'fast-check';

import { ALL_CELLS } from './board-cells.ts';
import { fittingMoves, hasRoomFor } from './placement.ts';
import { TILE_KINDS } from './tiles.ts';

import type { PlacedTile } from './trail-clear-types.ts';

const EMPTY: (PlacedTile | null)[] = ALL_CELLS.map(() => null);
/** River ends pointing north everywhere but the middle cell. */
const ONE_HOLE = ALL_CELLS.map((cell): PlacedTile | null =>
  cell === 12 ? null : { kind: 'river-end', turns: 0, placedAt: 1 },
);

describe('fittingMoves', () => {
  it('places a bridge only on the nine inner cells of an empty board, in two turns each', () => {
    const moves = fittingMoves(EMPTY, 'bridge');
    expect(moves).toHaveLength(18);
    expect(
      moves.every((move) => move.col >= 1 && move.col <= 3 && move.row >= 1 && move.row <= 3),
    ).toBe(true);
  });

  it('keeps the pinned number of placements of each kind on an empty board', () => {
    expect(TILE_KINDS.map((kind) => fittingMoves(EMPTY, kind).length)).toStrictEqual(
      GOLDEN_EMPTY_BOARD_COUNTS,
    );
  });

  it('finds the one placement left in a full board, or none', () => {
    expect(fittingMoves(ONE_HOLE, 'river-end')).toStrictEqual([
      { kind: 'place-tile', turns: 2, col: 2, row: 2 },
    ]);
    expect(fittingMoves(ONE_HOLE, 'bridge')).toStrictEqual([]);
  });
});

describe('hasRoomFor', () => {
  it('agrees with fittingMoves for every kind on any board (property)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...TILE_KINDS), fc.boolean(), (kind, isFull) => {
        const cells = isFull ? ONE_HOLE : EMPTY;
        expect(hasRoomFor(cells, kind)).toBe(fittingMoves(cells, kind).length > 0);
      }),
    );
  });
});

/** Placements per kind on an empty 5 x 5 board (road-end ... road-fork, in TILE_KINDS order). */
const GOLDEN_EMPTY_BOARD_COUNTS = [80, 30, 64, 80, 30, 64, 60, 18, 36, 48];
