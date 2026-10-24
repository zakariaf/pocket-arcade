// apps/trail-clear/src/board/tile-parts.ts
'worklet';
// Which unit paths draw one terrain of a tile. Inside a tile its road edges are joined and its river
// edges are joined: one edge is a stub that ends at a house (road) or a pond (river), two opposite
// edges run straight through, two neighbouring edges bend round, three or more meet in the middle.
// Sides are 0 north, 1 east, 2 south, 3 west; a turn rotates a north-based shape clockwise.

export type PartShape = 'stub' | 'spoke' | 'straight' | 'bend';

/** One shape of a terrain on a tile: a stub or spoke from side `turn`, a straight or bend from it. */
export type TrailPart = { readonly shape: PartShape; readonly turn: number };

/** Path layers by edge value (rules/tiles.ts: 1 road, 2 river); 0 (grass) names the road's dashes. */
const LAYERS = ['line', 'road', 'river'] as const;

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
