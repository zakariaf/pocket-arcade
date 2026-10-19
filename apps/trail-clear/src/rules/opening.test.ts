// apps/trail-clear/src/rules/opening.test.ts
import fc from 'fast-check';

import { seedRng } from '@e07/game-kit/rng/sfc32.ts';

import { neighbourOf, oppositeOf } from './board-cells.ts';
import { drawOpening, openingCells } from './opening.ts';
import { edgesOf } from './tiles.ts';
import { closedLoopsAt, fits } from './trails.ts';

import type { PlacedTile } from './trail-clear-types.ts';

const seedArb = fc.integer({ min: 0, max: 4_294_967_295 });

/** The opening of a seed: its board, the gap and the first tile. */
function openingOf(seed: number) {
  const { opening } = drawOpening(seedRng(seed));
  return { ...opening, cells: openingCells(opening) };
}

function tilesOn(cells: readonly (PlacedTile | null)[]): number {
  return cells.filter((tile) => tile !== null).length;
}

function withTile(
  cells: readonly (PlacedTile | null)[],
  at: number,
  tile: PlacedTile,
): (PlacedTile | null)[] {
  return cells.map((old, cell) => (cell === at ? tile : old));
}

describe('the opening (game-balance-and-bots: an early payoff by design)', () => {
  it('keeps the pinned opening of seed 1', () => {
    const { gap, roadSide, firstTile } = openingOf(1);
    expect({ gap, roadSide, firstTile }).toStrictEqual(GOLDEN_SEED_1_OPENING);
  });

  describe('properties', () => {
    it('leaves an inner cell empty, faced by a road end and a river end from opposite sides', () => {
      fc.assert(
        fc.property(seedArb, (seed) => {
          const { cells, gap, roadSide } = openingOf(seed);
          const roadCell = neighbourOf(gap, roadSide);
          const riverCell = neighbourOf(gap, oppositeOf(roadSide));
          expect(cells[gap]).toBeNull();
          expect(cells[roadCell]?.kind).toBe('road-end');
          expect(cells[riverCell]?.kind).toBe('river-end');
          expect(tilesOn(cells)).toBe(2);
        }),
      );
    });

    it('deals the ford first, and its one turn into the gap closes both loops (the payoff and the twist)', () => {
      fc.assert(
        fc.property(seedArb, (seed) => {
          const { cells, gap, roadSide, firstTile } = openingOf(seed);
          expect(firstTile).toBe('ford');
          expect(fits(cells, gap, edgesOf('ford', roadSide))).toBe(true);
          const placed = withTile(cells, gap, { kind: firstTile, turns: roadSide, placedAt: 1 });
          expect(closedLoopsAt(placed, gap)).toHaveLength(2);
        }),
      );
    });
  });

  it('varies with the seed: 50 seeds give at least 20 different openings', () => {
    const openings = Array.from({ length: 50 }, (_, seed) => {
      const { gap, roadSide } = openingOf(seed);
      return `${String(gap)}/${String(roadSide)}`;
    });
    expect(new Set(openings).size).toBeGreaterThanOrEqual(20);
  });
});

const GOLDEN_SEED_1_OPENING = { gap: 13, roadSide: 1, firstTile: 'ford' };
