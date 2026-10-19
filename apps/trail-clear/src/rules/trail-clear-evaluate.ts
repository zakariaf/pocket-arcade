// apps/trail-clear/src/rules/trail-clear-evaluate.ts
// How good a Trail Clear position looks to a reasonable player. Lives in rules/ because both the
// bots (testing/) and the level witness (levels/) play with it, and levels may import only rules.
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';

import { ALL_CELLS, SIDES, neighbourOf, oppositeOf } from './board-cells.ts';
import { GRASS, RIVER, ROAD, TILE_KINDS, distinctTurns, edgesOf } from './tiles.ts';
import { knobsFor } from './trail-clear-tuning.ts';
import { edgesAt, fits } from './trails.ts';

import type { DifficultyKnobs } from './trail-clear-tuning.ts';
import type { PlacedTile, Terrain, TrailClearState } from './trail-clear-types.ts';

type Cells = readonly (PlacedTile | null)[];

/** Weights of the evaluation: points first, then room to play, minus loose ends and dead holes. */
const ROOM_WEIGHT = 6;
const LOOSE_END_WEIGHT = 4;
const DEAD_CELL_WEIGHT = 12;
const DOUBLE_SPOT_WEIGHT = 8;

/** What the board offers the next tiles. */
export type BoardShape = {
  /** Road and river edges that face an empty cell. */
  readonly looseEnds: number;
  /** Empty cells where no tile the row deals fits in any turn (a hole only a wipe reopens). */
  readonly deadCells: number;
  /** Empty cells faced by a road end and a river end at once (a double waits there). */
  readonly doubleSpots: number;
  readonly emptyCells: number;
};

function canFill(cells: Cells, cell: number, knobs: DifficultyKnobs): boolean {
  return TILE_KINDS.some(
    (kind) =>
      knobs.weights[kind] > 0 &&
      distinctTurns(kind).some((turns) => fits(cells, cell, edgesOf(kind, turns))),
  );
}

/** The roads and rivers of the tiles around an empty cell that point into it. */
function facingTerrains(cells: Cells, cell: number): Terrain[] {
  return SIDES.flatMap((side) => {
    const edges = edgesAt(cells, neighbourOf(cell, side));
    const facing = edges === null ? GRASS : pickAt(edges, oppositeOf(side));
    return facing === GRASS ? [] : [facing];
  });
}

/** Counts the board's loose ends, dead cells and double spots for the row's deal. */
export function boardShape(cells: Cells, knobs: DifficultyKnobs): BoardShape {
  const empty = ALL_CELLS.filter((cell) => pickAt(cells, cell) === null);
  const facing = empty.map((cell) => facingTerrains(cells, cell));
  return {
    looseEnds: facing.reduce((sum, terrains) => sum + terrains.length, 0),
    deadCells: empty.filter((cell) => !canFill(cells, cell, knobs)).length,
    doubleSpots: facing.filter((terrains) => terrains.includes(ROAD) && terrains.includes(RIVER))
      .length,
    emptyCells: empty.length,
  };
}

/** How good a position looks to the bots (higher is better). */
export function evaluateTrailClear(state: TrailClearState): number {
  const shape = boardShape(state.cells, knobsFor(state.difficulty));
  const room = shape.emptyCells - shape.deadCells;
  return (
    state.score +
    room * ROOM_WEIGHT -
    shape.looseEnds * LOOSE_END_WEIGHT -
    shape.deadCells * DEAD_CELL_WEIGHT +
    shape.doubleSpots * DOUBLE_SPOT_WEIGHT
  );
}
