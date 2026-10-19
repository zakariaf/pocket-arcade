// apps/trail-clear/src/rules/trails.test.ts
import fc from 'fast-check';

import { ALL_CELLS } from './board-cells.ts';
import { TILE_KINDS, edgesOf } from './tiles.ts';
import { closedLoopsAt, fits, trailFrom } from './trails.ts';

import type { PlacedTile, TileKind } from './trail-clear-types.ts';

type Layout = Readonly<Record<number, readonly [TileKind, number]>>;

/** A 5 x 5 board with the given tiles: { cell: [kind, turns] }. */
function boardOf(layout: Layout): (PlacedTile | null)[] {
  return ALL_CELLS.map((cell) => {
    const entry = layout[cell];
    return entry === undefined ? null : { kind: entry[0], turns: entry[1], placedAt: 1 };
  });
}

describe('fits (spec 13: edges must match; the rim counts as grass)', () => {
  it('takes any tile with grass toward the rim on an empty board', () => {
    expect(fits(boardOf({}), 12, edgesOf('bridge', 0))).toBe(true);
    expect(fits(boardOf({}), 2, edgesOf('road-end', 2))).toBe(true);
  });

  it('refuses a road or a river that would run off the board', () => {
    expect(fits(boardOf({}), 2, edgesOf('road-end', 0))).toBe(false);
    expect(fits(boardOf({}), 0, edgesOf('river-bend', 3))).toBe(false);
  });

  it('takes a road against a road and refuses it against grass or a river', () => {
    const board = boardOf({ 12: ['road-end', 1] });
    expect(fits(board, 13, edgesOf('road-end', 3))).toBe(true);
    expect(fits(board, 13, edgesOf('road-end', 0))).toBe(false);
    expect(fits(board, 13, edgesOf('river-end', 3))).toBe(false);
  });

  it('refuses a cell that already holds a tile', () => {
    expect(fits(boardOf({ 12: ['road-end', 1] }), 12, edgesOf('road-end', 1))).toBe(false);
  });
});

describe('trailFrom', () => {
  it('closes two road ends that face each other', () => {
    const board = boardOf({ 12: ['road-end', 1], 13: ['road-end', 3] });
    expect(trailFrom(board, 13, 1)).toStrictEqual({ cells: [12, 13], isClosed: true });
  });

  it('leaves a road open while one end faces an empty cell', () => {
    const board = boardOf({ 12: ['road-end', 1], 13: ['road-straight', 1] });
    expect(trailFrom(board, 12, 1)).toStrictEqual({ cells: [12, 13], isClosed: false });
  });

  it('closes a ring of four bends, whatever tile it starts from', () => {
    const ring = {
      6: ['road-bend', 1],
      7: ['road-bend', 2],
      11: ['road-bend', 0],
      12: ['road-bend', 3],
    } as const;
    for (const start of [6, 7, 11, 12]) {
      expect(trailFrom(boardOf(ring), start, 1)).toStrictEqual({
        cells: [6, 7, 11, 12],
        isClosed: true,
      });
    }
  });

  it('follows one terrain only: a bridge joins the road and the river apart', () => {
    const board = boardOf({ 7: ['road-end', 2], 12: ['bridge', 0], 11: ['river-end', 1] });
    expect(trailFrom(board, 12, 1).cells).toStrictEqual([7, 12]);
    expect(trailFrom(board, 12, 2).cells).toStrictEqual([11, 12]);
  });

  it('finds no trail on an empty cell', () => {
    expect(trailFrom(boardOf({}), 12, 1)).toStrictEqual({ cells: [], isClosed: false });
  });
});

describe('closedLoopsAt', () => {
  it('closes the road and the river at once through a ford (the twist)', () => {
    const board = boardOf({ 7: ['road-end', 2], 12: ['ford', 0], 17: ['river-end', 0] });
    expect(closedLoopsAt(board, 12)).toStrictEqual([
      { terrain: 'road', cells: [7, 12] },
      { terrain: 'river', cells: [12, 17] },
    ]);
  });

  it('closes nothing while an end is loose, and nothing on an empty cell', () => {
    expect(closedLoopsAt(boardOf({ 12: ['road-end', 1] }), 12)).toStrictEqual([]);
    expect(closedLoopsAt(boardOf({}), 12)).toStrictEqual([]);
  });

  it('closes no loop with a lone tile on the board (property)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TILE_KINDS),
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 0, max: 24 }),
        (kind, turns, cell) => {
          expect(closedLoopsAt(boardOf({ [cell]: [kind, turns] }), cell)).toStrictEqual([]);
        },
      ),
    );
  });
});
