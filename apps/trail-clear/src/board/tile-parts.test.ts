// apps/trail-clear/src/board/tile-parts.test.ts
// Spec 13 (trail-clear): roads and rivers are drawn as paths on each tile. Inside a tile its road
// edges are joined and its river edges are joined; one edge ends at a house (road) or a pond (river).
import fc from 'fast-check';

import { TILE_KINDS, edgesOf } from '@e07/trail-clear/rules/tiles.ts';

import { capCentre, partPath, trailParts } from './tile-parts.ts';

const ROAD = 1;
const RIVER = 2;

describe('trailParts', () => {
  it('ends a single road edge in a stub (the house sits at its end)', () => {
    expect(trailParts(edgesOf('road-end', 1), ROAD)).toStrictEqual([{ shape: 'stub', turn: 1 }]);
  });

  it('runs two opposite edges straight through and two neighbouring edges round a bend', () => {
    expect(trailParts(edgesOf('river-straight', 1), RIVER)).toStrictEqual([
      { shape: 'straight', turn: 1 },
    ]);
    expect(trailParts(edgesOf('road-bend', 0), ROAD)).toStrictEqual([{ shape: 'bend', turn: 0 }]);
    // West and north are neighbours too: the bend that starts on the west side.
    expect(trailParts(edgesOf('road-bend', 3), ROAD)).toStrictEqual([{ shape: 'bend', turn: 3 }]);
  });

  it('joins three road edges in the middle with spokes (the fork)', () => {
    expect(trailParts(edgesOf('road-fork', 2), ROAD)).toStrictEqual([
      { shape: 'spoke', turn: 0 },
      { shape: 'spoke', turn: 2 },
      { shape: 'spoke', turn: 3 },
    ]);
  });

  it('draws nothing for a terrain the tile does not carry, and both on a bridge', () => {
    expect(trailParts(edgesOf('road-straight', 0), RIVER)).toStrictEqual([]);
    expect([
      trailParts(edgesOf('bridge', 0), ROAD),
      trailParts(edgesOf('bridge', 0), RIVER),
    ]).toStrictEqual([[{ shape: 'straight', turn: 0 }], [{ shape: 'straight', turn: 1 }]]);
  });

  it('covers every edge of every tile in every turn with exactly one part (property)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...TILE_KINDS), fc.integer({ min: 0, max: 3 }), (kind, turns) => {
        const edges = edgesOf(kind, turns);
        for (const terrain of [ROAD, RIVER]) {
          const sides = [0, 1, 2, 3].filter((side) => edges[side] === terrain);
          const parts = trailParts(edges, terrain);
          expect(parts.flatMap((part) => sidesOf(part)).sort()).toStrictEqual(sides);
        }
      }),
      { numRuns: 80 },
    );
  });
});

/** The tile sides a part reaches (what the property compares with the tile's edges). */
function sidesOf(part: { readonly shape: string; readonly turn: number }): number[] {
  if (part.shape === 'straight') return [part.turn, part.turn + 2];
  if (part.shape === 'bend') return [part.turn, (part.turn + 1) % 4];
  return [part.turn];
}

describe('partPath', () => {
  it('names one unit path per terrain, shape and turn', () => {
    expect([
      partPath(ROAD, { shape: 'bend', turn: 2 }),
      partPath(RIVER, { shape: 'stub', turn: 0 }),
      partPath(0, { shape: 'straight', turn: 1 }),
    ]).toStrictEqual(['road-bend-2', 'river-stub-0', 'line-straight-1']);
  });
});

describe('capCentre', () => {
  it('puts the end of a stub inside the tile on the side it comes from', () => {
    expect([0, 1, 2, 3].map((side) => capCentre(side))).toStrictEqual([
      { x: 0.5, y: 0.36 },
      { x: 0.64, y: 0.5 },
      { x: 0.5, y: 0.64 },
      { x: 0.36, y: 0.5 },
    ]);
  });

  it('keeps the house and the pond of a ford apart (its road ends north, its river south)', () => {
    const edges = edgesOf('ford', 0);
    expect([edges[0], edges[2]]).toStrictEqual([ROAD, RIVER]);
    expect(capCentre(2).y - capCentre(0).y).toBeGreaterThan(0.25);
  });
});
