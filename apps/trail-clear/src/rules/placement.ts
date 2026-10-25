// apps/trail-clear/src/rules/placement.ts
// Where the offered tile fits, in the fixed order bots, solvers and replays rely on: row by row,
// column by column, then each distinct turn of the tile.
import { ALL_CELLS } from './board-cells.ts';
import { distinctTurns, edgesOf } from './tiles.ts';
import { TUNING } from './trail-clear-tuning.ts';
import { fits } from './trails.ts';

import type { PlacedTile, TileKind, TrailClearMove } from './trail-clear-types.ts';

type Cells = readonly (PlacedTile | null)[];

const SIZE = TUNING.boardSize;

/** Every placement of `tile` that fits the board, as moves. */
export function fittingMoves(cells: Cells, tile: TileKind): TrailClearMove[] {
  const turns = distinctTurns(tile);
  return ALL_CELLS.flatMap((cell) =>
    turns
      .filter((turn) => fits(cells, cell, edgesOf(tile, turn)))
      .map((turn): TrailClearMove => ({
        kind: 'place-tile',
        turns: turn,
        col: cell % SIZE,
        row: Math.floor(cell / SIZE),
      })),
  );
}

/** True as soon as `tile` fits somewhere (cheaper than listing every move). */
export function hasRoomFor(cells: Cells, tile: TileKind): boolean {
  const turns = distinctTurns(tile);
  return ALL_CELLS.some((cell) => turns.some((turn) => fits(cells, cell, edgesOf(tile, turn))));
}
