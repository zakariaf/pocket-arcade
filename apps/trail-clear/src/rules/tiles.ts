// apps/trail-clear/src/rules/tiles.ts
// The ten tile kinds and their turns. Inside a tile its road edges are joined and its river edges
// are joined: one road edge ends the road at a little house, one river edge ends the river at a pond.
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';

import type { Edges, Terrain, TileKind } from './trail-clear-types.ts';

/** 0 grass, 1 road, 2 river: the edge values of Edges. */
export const GRASS = 0;
export const ROAD = 1;
export const RIVER = 2;

/** Every kind's edges in its first turn (north, east, south, west), in a fixed order. */
export const TILE_EDGES: Readonly<Record<TileKind, Edges>> = {
  'road-end': [ROAD, GRASS, GRASS, GRASS],
  'road-straight': [ROAD, GRASS, ROAD, GRASS],
  'road-bend': [ROAD, ROAD, GRASS, GRASS],
  'river-end': [RIVER, GRASS, GRASS, GRASS],
  'river-straight': [RIVER, GRASS, RIVER, GRASS],
  'river-bend': [RIVER, RIVER, GRASS, GRASS],
  ford: [ROAD, GRASS, RIVER, GRASS],
  bridge: [ROAD, RIVER, ROAD, RIVER],
  'twin-bend': [ROAD, ROAD, RIVER, RIVER],
  'road-fork': [ROAD, ROAD, ROAD, GRASS],
};

/** The kinds in the table's order (bots, the deal and the board use it). */
export const TILE_KINDS = Object.keys(TILE_EDGES) as readonly TileKind[];

/** A kind's edges after `turns` quarter turns clockwise: its north edge moves to the east, and so on. */
export function edgesOf(kind: TileKind, turns: number): Edges {
  const base = TILE_EDGES[kind];
  const shift = ((turns % 4) + 4) % 4;
  const at = (side: number): Terrain => pickAt(base, (side - shift + 4) % 4);
  return [at(0), at(1), at(2), at(3)];
}

/** The turns 0..3 that give different edges, each pattern once at its lowest turn (2 or 4 of them). */
export function distinctTurns(kind: TileKind): readonly number[] {
  const patterns = [0, 1, 2, 3].map((turn) => edgesOf(kind, turn).join(''));
  return [0, 1, 2, 3].filter((turn) => patterns.indexOf(pickAt(patterns, turn)) === turn);
}

/** True when the kind's id is one of the ten (parsing saved runs). */
export function isTileKind(value: unknown): value is TileKind {
  return typeof value === 'string' && Object.hasOwn(TILE_EDGES, value);
}
