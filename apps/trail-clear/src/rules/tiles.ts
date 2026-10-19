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

const QUARTER_TURNS = [0, 1, 2, 3] as const;

/** The base edges turned `shift` quarter turns clockwise (shift 0..3). */
function turned(base: Edges, shift: number): Edges {
  const at = (side: number): Terrain => pickAt(base, (side - shift + 4) % 4);
  return [at(0), at(1), at(2), at(3)];
}

/** A table with one entry per kind, made by `make` (every key spelled out, so the type is exact). */
function byKind<T>(make: (kind: TileKind) => T): Readonly<Record<TileKind, T>> {
  return {
    'road-end': make('road-end'),
    'road-straight': make('road-straight'),
    'road-bend': make('road-bend'),
    'river-end': make('river-end'),
    'river-straight': make('river-straight'),
    'river-bend': make('river-bend'),
    ford: make('ford'),
    bridge: make('bridge'),
    'twin-bend': make('twin-bend'),
    'road-fork': make('road-fork'),
  };
}

/** Every kind's edges in each of its four turns, worked out once: the bots ask millions of times. */
const TURNED_EDGES = byKind((kind) =>
  QUARTER_TURNS.map((shift) => turned(TILE_EDGES[kind], shift)),
);

/** Every kind's distinct turns: each edge pattern once, at its lowest turn (2 or 4 of them). */
const DISTINCT_TURNS = byKind((kind) => {
  const patterns = TURNED_EDGES[kind].map((edges) => edges.join(''));
  return QUARTER_TURNS.filter((turn) => patterns.indexOf(pickAt(patterns, turn)) === turn);
});

/** A kind's edges after `turns` quarter turns clockwise: its north edge moves to the east, and so on. */
export function edgesOf(kind: TileKind, turns: number): Edges {
  return pickAt(TURNED_EDGES[kind], ((turns % 4) + 4) % 4);
}

/** The turns 0..3 that give different edges, each pattern once at its lowest turn (2 or 4 of them). */
export function distinctTurns(kind: TileKind): readonly number[] {
  return DISTINCT_TURNS[kind];
}

/** True when the kind's id is one of the ten (parsing saved runs). */
export function isTileKind(value: unknown): value is TileKind {
  return typeof value === 'string' && Object.hasOwn(TILE_EDGES, value);
}
