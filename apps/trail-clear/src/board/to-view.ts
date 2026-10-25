// apps/trail-clear/src/board/to-view.ts
// Spec 13 (trail-clear) risk: ""what gets wiped" is hard to read before committing". The view
// works out, once per move on the JS thread, where each turn of the offered tile fits and which
// tiles that placement would wipe for how many points, so draw() only reads it.
import { pointsFor, wipedCells } from '@e07/trail-clear/rules/apply-move.ts';
import { distinctTurns, edgesOf } from '@e07/trail-clear/rules/tiles.ts';
import { TUNING } from '@e07/trail-clear/rules/trail-clear-tuning.ts';
import { closedLoopsAt, fits } from '@e07/trail-clear/rules/trails.ts';

import type { ViewFormat } from '@e07/shell/game-host/board-types.ts';
import type {
  PlacedTile,
  TileKind,
  TrailClearState,
} from '@e07/trail-clear/rules/trail-clear-types.ts';

/** Flat and serialisable: it is copied into the scene shared value once per move. */
export type TrailClearView = {
  /** Cells per side. */
  readonly size: number;
  /** Row-major; a tile as its edges north, east, south, west (0 grass, 1 road, 2 river); [] = empty. */
  readonly cells: readonly (readonly number[])[];
  /** One tray slot per distinct turn of the offered tile, as its edges in that turn; [] = bag empty. */
  readonly tray: readonly (readonly number[])[];
  /**
   * Per tray slot, per cell: -1 when that turn does not fit there; else the cells the placement
   * would wipe as a bit mask (bit n = cell n; 0 = it closes nothing).
   */
  readonly wipes: readonly (readonly number[])[];
  /** Per tray slot, per cell: the points that placement would score, digits localised; '' = none. */
  readonly pointsText: readonly (readonly string[])[];
};

type Cells = readonly (PlacedTile | null)[];
type Preview = { readonly mask: number; readonly points: number };

const NO_FIT: Preview = { mask: -1, points: 0 };

/** What placing `tile` turned `turns` on `cell` would wipe and score, or NO_FIT. */
function previewAt(cells: Cells, placed: PlacedTile, cell: number): Preview {
  if (!fits(cells, cell, edgesOf(placed.kind, placed.turns))) return NO_FIT;
  const filled = cells.map((old, index) => (index === cell ? placed : old));
  const loops = closedLoopsAt(filled, cell);
  const mask = wipedCells(loops).reduce((bits, wiped) => bits | (1 << wiped), 0);
  return { mask, points: pointsFor(loops) };
}

function previewsFor(state: TrailClearState, tile: TileKind, turns: number): Preview[] {
  const placed: PlacedTile = { kind: tile, turns, placedAt: state.placements + 1 };
  return state.cells.map((_, cell) => previewAt(state.cells, placed, cell));
}

/** JS thread, pure: the final state of a move, in the shape draw() reads. */
export function toView(state: TrailClearState, format: ViewFormat): TrailClearView {
  const tile = state.offered;
  const turns = tile === null ? [] : distinctTurns(tile);
  const previews = tile === null ? [] : turns.map((turn) => previewsFor(state, tile, turn));
  return {
    size: TUNING.boardSize,
    cells: state.cells.map((placed) => (placed === null ? [] : edgesOf(placed.kind, placed.turns))),
    tray: tile === null ? [] : turns.map((turn) => edgesOf(tile, turn)),
    wipes: previews.map((slot) => slot.map((preview) => preview.mask)),
    pointsText: previews.map((slot) =>
      slot.map((preview) => (preview.points > 0 ? format.formatNumber(preview.points) : '')),
    ),
  };
}
