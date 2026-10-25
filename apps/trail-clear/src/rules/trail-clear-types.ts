// apps/trail-clear/src/rules/trail-clear-types.ts
// Trail Clear v1 (spec 13, catalogue entry 11): edge-matching tiles on a 5 x 5 board. Drag the
// offered tile onto an empty cell, turned the way it should face; every edge must match the tile it
// touches (road to road, river to river, grass to grass) and the rim counts as grass. A road or a
// river with no loose end is a closed loop: the placement that closes it scores it and wipes its
// tiles. A level deals a bag of tiles and is won when the last one is placed; the run is lost when
// the offered tile fits nowhere.
import type { ApplyResult } from '@e07/game-kit/contract/game-engine.ts';
import type { RngState } from '@e07/game-kit/rng/sfc32.ts';

/** What one tile edge carries: 0 grass, 1 road, 2 river (numbers: compact in saves and goldens). */
export type Terrain = 0 | 1 | 2;

/** The terrains that make loops, by name (events and the board say which one closed). */
export type TrailTerrain = 'road' | 'river';

/** A tile's four edges in board order: north, east, south, west. */
export type Edges = readonly [Terrain, Terrain, Terrain, Terrain];

/** The ten tile kinds (tiles.ts holds their edges in their first turn). */
export type TileKind =
  | 'road-end'
  | 'road-straight'
  | 'road-bend'
  | 'river-end'
  | 'river-straight'
  | 'river-bend'
  | 'ford'
  | 'bridge'
  | 'twin-bend'
  | 'road-fork';

/** A tile on the board: its kind, its quarter turns clockwise (0..3) and when it was placed. */
export type PlacedTile = {
  readonly kind: TileKind;
  readonly turns: number;
  /** 0 for the opening's tiles, else the placement that put it there (1, 2, ...); the oldest row goes first in a continue. */
  readonly placedAt: number;
};

export type TrailClearState = {
  /** 0..100 as passed to create (clamped); ENDLESS_DIFFICULTY is the endless run. */
  readonly difficulty: number;
  /** boardSize x boardSize, row-major (index = row * boardSize + col); null = empty. */
  readonly cells: readonly (PlacedTile | null)[];
  /** The tile to place now; null once a level's bag is empty (the level is won). */
  readonly offered: TileKind | null;
  /** Tiles placed so far (the bag of a level holds knobsFor(difficulty).bag). */
  readonly placements: number;
  readonly score: number;
  /** Loops closed so far (a double counts two). */
  readonly loopsClosed: number;
  /** The one continue of the run was used (spec 8.10); a second one is refused. */
  readonly hasContinued: boolean;
  readonly rng: RngState;
};

/** A tile a loop or a continue took off the board: its kind and its quarter turns. */
export type WipedTile = { readonly kind: TileKind; readonly turns: number };

/** Place the offered tile, turned `turns` quarter turns clockwise, on the cell (col, row). */
export type TrailClearMove = {
  readonly kind: 'place-tile';
  readonly turns: number;
  readonly col: number;
  readonly row: number;
};

/**
 * Past tense, kebab-case, with every cell and value the board, the sounds and the counters need.
 * Only the continue emits rows-cleared.
 */
export type TrailClearEvent =
  | {
      readonly kind: 'tile-placed';
      readonly tile: TileKind;
      readonly turns: number;
      readonly cell: number;
    }
  | {
      readonly kind: 'loop-closed';
      readonly terrain: TrailTerrain;
      /** The loop's cells, ascending; its size is cells.length. */
      readonly cells: readonly number[];
      readonly points: number;
    }
  | { readonly kind: 'double-closed'; readonly bonus: number }
  | {
      readonly kind: 'tiles-wiped';
      readonly cells: readonly number[];
      /** The tile that leaves each of those cells, in the same order (the board draws it going). */
      readonly tiles: readonly WipedTile[];
    }
  | { readonly kind: 'score-added'; readonly points: number; readonly total: number }
  | { readonly kind: 'tile-dealt'; readonly tile: TileKind }
  | {
      readonly kind: 'rows-cleared';
      readonly rows: readonly number[];
      readonly cells: readonly number[];
      /** The tile that leaves each of those cells, in the same order. */
      readonly tiles: readonly WipedTile[];
    };

export type TrailClearResult = ApplyResult<TrailClearState, TrailClearEvent>;
