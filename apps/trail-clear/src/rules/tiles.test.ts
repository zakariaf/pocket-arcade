// apps/trail-clear/src/rules/tiles.test.ts
import fc from 'fast-check';

import {
  GRASS,
  RIVER,
  ROAD,
  TILE_EDGES,
  TILE_KINDS,
  distinctTurns,
  edgesOf,
  isTileKind,
} from './tiles.ts';

const kindArb = fc.constantFrom(...TILE_KINDS);
const turnsArb = fc.integer({ min: 0, max: 3 });

describe('edgesOf (spec 13: edge-matching tiles)', () => {
  it('gives a kind its own edges in its first turn', () => {
    expect(edgesOf('road-bend', 0)).toStrictEqual([ROAD, ROAD, GRASS, GRASS]);
  });

  it('turns the north edge to the east with one quarter turn clockwise', () => {
    expect(edgesOf('road-end', 1)).toStrictEqual([GRASS, ROAD, GRASS, GRASS]);
    expect(edgesOf('ford', 1)).toStrictEqual([GRASS, ROAD, GRASS, RIVER]);
  });

  it('keeps the pinned edges of every kind turned twice', () => {
    const text = TILE_KINDS.map((kind) => `${kind}:${edgesOf(kind, 2).join('')}`).join(' ');
    expect(text).toBe(GOLDEN_TURNED_TWICE);
  });

  describe('properties', () => {
    it('comes back to the first turn after four quarter turns', () => {
      fc.assert(
        fc.property(kindArb, turnsArb, (kind, turns) => {
          expect(edgesOf(kind, turns + 4)).toStrictEqual(edgesOf(kind, turns));
        }),
      );
    });

    it('keeps the number of roads and rivers whatever the turn', () => {
      fc.assert(
        fc.property(kindArb, turnsArb, (kind, turns) => {
          const sorted = [...edgesOf(kind, turns)].sort();
          expect(sorted).toStrictEqual([...TILE_EDGES[kind]].sort());
        }),
      );
    });
  });
});

describe('distinctTurns', () => {
  it('lists two turns for a tile that looks the same turned half way round', () => {
    expect(distinctTurns('road-straight')).toStrictEqual([0, 1]);
    expect(distinctTurns('bridge')).toStrictEqual([0, 1]);
  });

  it('lists all four turns for an end piece, a bend and the ford', () => {
    for (const kind of ['road-end', 'river-bend', 'ford'] as const) {
      expect(distinctTurns(kind)).toStrictEqual([0, 1, 2, 3]);
    }
  });

  it('lists no two turns with the same edges', () => {
    for (const kind of TILE_KINDS) {
      const patterns = distinctTurns(kind).map((turns) => edgesOf(kind, turns).join(''));
      expect(new Set(patterns).size).toBe(patterns.length);
    }
  });
});

describe('isTileKind', () => {
  it('knows the ten kinds and nothing else', () => {
    expect(TILE_KINDS).toHaveLength(10);
    expect(TILE_KINDS.every((kind) => isTileKind(kind))).toBe(true);
    expect([null, 3, 'toString', 'road'].some((value) => isTileKind(value))).toBe(false);
  });
});

const GOLDEN_TURNED_TWICE = [
  'road-end:0010',
  'road-straight:1010',
  'road-bend:0011',
  'river-end:0020',
  'river-straight:2020',
  'river-bend:0022',
  'ford:2010',
  'bridge:1212',
  'twin-bend:2211',
  'road-fork:1011',
].join(' ');
