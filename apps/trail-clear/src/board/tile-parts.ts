// apps/trail-clear/src/board/tile-parts.ts
'worklet';
// Which unit paths draw one terrain of a tile. Inside a tile its road edges are joined and its river
// edges are joined: one edge is a stub that ends at a house (road) or a pond (river), two opposite
// edges run straight through, two neighbouring edges bend round, three or more meet in the middle.
// Sides are 0 north, 1 east, 2 south, 3 west; a turn rotates a north-based shape clockwise.

import { pickAt } from '@e07/game-kit/rng/pick-at.ts';

export type PartShape = 'stub' | 'spoke' | 'straight' | 'bend';

/** One shape of a terrain on a tile: a stub or spoke from side `turn`, a straight or bend from it. */
export type TrailPart = { readonly shape: PartShape; readonly turn: number };

/** Path layers by edge value (rules/tiles.ts: 1 road, 2 river); 0 (grass) names the road's dashes. */
const LAYERS = ['line', 'road', 'river'] as const;
const DASHES = 0;
const ROAD = 1;
const RIVER = 2;

/** Where a stub ends inside the tile, from north: its house or pond is centred there. */
export const STUB_END = 0.36;

const SIDES = [0, 1, 2, 3] as const;

/** The parts that draw the edges of `terrain` on a tile with these edges (none for grass). */
export function trailParts(edges: readonly number[], terrain: number): TrailPart[] {
  const sides = SIDES.filter((side) => edges[side] === terrain);
  const [first, second] = sides;
  if (first === undefined) return [];
  if (sides.length === 1) return [{ shape: 'stub', turn: first }];
  if (sides.length > 2 || second === undefined) {
    return sides.map((side) => ({ shape: 'spoke', turn: side }));
  }
  if (second - first === 2) return [{ shape: 'straight', turn: first }];
  // Neighbours: the bend starts on the side whose clockwise neighbour is the other one.
  return [{ shape: 'bend', turn: (first + 1) % 4 === second ? first : second }];
}

/** The kit's path name for a part: road and river bands, or the road's centre dashes (terrain 0). */
export function partPath(terrain: number, part: TrailPart): string {
  return `${LAYERS[terrain] ?? 'line'}-${part.shape}-${String(part.turn)}`;
}

/** What one tile draws, layer by layer: the kit's path names, and where its trails end. */
export type TileLayers = {
  readonly river: readonly string[];
  readonly road: readonly string[];
  /** The road's centre dashes. */
  readonly dashes: readonly string[];
  /** Centre of the pond where a river with one edge ends, or null. */
  readonly pond: { readonly x: number; readonly y: number } | null;
  /** The kit's path name of the house where a road with one edge ends, or null. */
  readonly house: string | null;
};

/** Centre of a stub's end cap (its house or pond) in the unit tile, for a stub from `side`. */
export function capCentre(side: number): { readonly x: number; readonly y: number } {
  switch (side) {
    case 1:
      return { x: 1 - STUB_END, y: 0.5 };
    case 2:
      return { x: 0.5, y: 1 - STUB_END };
    case 3:
      return { x: STUB_END, y: 0.5 };
    default:
      return { x: 0.5, y: STUB_END };
  }
}

/** The single stub of a terrain with one edge (where its trail ends), or null. */
function stubOf(parts: readonly TrailPart[]): TrailPart | null {
  const [only] = parts;
  return parts.length === 1 && only?.shape === 'stub' ? only : null;
}

/** The layers of a tile with these edges, built from its parts. */
function layersOf(edges: readonly number[]): TileLayers {
  const river = trailParts(edges, RIVER);
  const road = trailParts(edges, ROAD);
  const pond = stubOf(river);
  const house = stubOf(road);
  return {
    river: river.map((part) => partPath(RIVER, part)),
    road: road.map((part) => partPath(ROAD, part)),
    dashes: road.map((part) => partPath(DASHES, part)),
    pond: pond === null ? null : capCentre(pond.turn),
    house: house === null ? null : `house-${String(house.turn)}`,
  };
}

/** Every tile's layers, indexed by its edges (each 0, 1 or 2, north first) read in base 3. */
const TILE_LAYERS: readonly TileLayers[] = Array.from({ length: 81 }, (_, index) =>
  layersOf([
    index % 3,
    Math.floor(index / 3) % 3,
    Math.floor(index / 9) % 3,
    Math.floor(index / 27),
  ]),
);

/**
 * The paths and ends a tile with these edges draws, looked up in a table built once at load: a
 * frame builds no parts and no path names.
 */
export function tileLayers(edges: readonly number[]): TileLayers {
  const [north = 0, east = 0, south = 0, west = 0] = edges;
  return pickAt(TILE_LAYERS, north + 3 * east + 9 * south + 27 * west);
}
