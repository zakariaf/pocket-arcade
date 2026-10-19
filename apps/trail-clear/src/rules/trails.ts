// apps/trail-clear/src/rules/trails.ts
// Where a tile fits, and which loops a placement closes. A road (or river) is the set of tiles its
// edges join; it is a closed loop when none of its edges faces an empty cell (the rim never carries
// a road or a river: fits() keeps it grass).
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';

import { SIDES, neighbourOf, oppositeOf } from './board-cells.ts';
import { GRASS, RIVER, ROAD, edgesOf } from './tiles.ts';

import type { Edges, PlacedTile, Terrain, TrailTerrain } from './trail-clear-types.ts';

type Cells = readonly (PlacedTile | null)[];

/** A loop a placement closed: its terrain and its cells, ascending. */
export type ClosedLoop = { readonly terrain: TrailTerrain; readonly cells: readonly number[] };

/** The edges of the tile on `cell`, or null for an empty cell or off the board. */
export function edgesAt(cells: Cells, cell: number): Edges | null {
  const tile = cell < 0 ? null : pickAt(cells, cell);
  return tile === null ? null : edgesOf(tile.kind, tile.turns);
}

/** True when a tile with these edges may go on the empty `cell`: every side matches, the rim is grass. */
export function fits(cells: Cells, cell: number, edges: Edges): boolean {
  if (pickAt(cells, cell) !== null) return false;
  return SIDES.every((side) => {
    const next = neighbourOf(cell, side);
    if (next < 0) return edges[side] === GRASS;
    const touching = edgesAt(cells, next);
    return touching === null || touching[oppositeOf(side)] === edges[side];
  });
}

/** The cells the `terrain` through `start` joins, and whether it has no loose end (none on an empty cell). */
export function trailFrom(
  cells: Cells,
  start: number,
  terrain: Terrain,
): { readonly cells: number[]; readonly isClosed: boolean } {
  const first = edgesAt(cells, start);
  if (first === null) return { cells: [], isClosed: false };
  const visited: { readonly cell: number; readonly edges: Edges }[] = [
    { cell: start, edges: first },
  ];
  let isClosed = true;
  for (let index = 0; index < visited.length; index += 1) {
    const { cell, edges } = pickAt(visited, index);
    for (const side of SIDES.filter((each) => edges[each] === terrain)) {
      const next = neighbourOf(cell, side);
      const nextEdges = edgesAt(cells, next);
      if (nextEdges === null) isClosed = false;
      else if (!visited.some((seen) => seen.cell === next))
        visited.push({ cell: next, edges: nextEdges });
    }
  }
  return { cells: visited.map((seen) => seen.cell).sort((a, b) => a - b), isClosed };
}

/** The loops the tile on `cell` closes: the road first, then the river (0, 1 or 2 loops). */
export function closedLoopsAt(cells: Cells, cell: number): ClosedLoop[] {
  const edges = edgesAt(cells, cell);
  if (edges === null) return [];
  const loops: ClosedLoop[] = [];
  for (const [terrain, name] of [
    [ROAD, 'road'],
    [RIVER, 'river'],
  ] as const) {
    if (!edges.includes(terrain)) continue;
    const trail = trailFrom(cells, cell, terrain);
    if (trail.isClosed) loops.push({ terrain: name, cells: trail.cells });
  }
  return loops;
}
