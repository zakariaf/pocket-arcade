// apps/toggle-drop/src/board/layout-board.ts
'worklet';

import { fitGrid } from '@e07/game-kit/geom/board-layout.ts';

import { BOARD_UNITS } from './board-ids.ts';

import type { ToggleDropView } from './to-view.ts';
import type { BoardLayout, GridRegion, Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { LayoutInput } from '@e07/shell/game-host/board-types.ts';

const PAD = 8;
/** Rows above the grid for the rack of balls left. */
const RACK_ROWS = 1;

/**
 * One 'board' grid region of square cells, the largest that fit: a column per drop column and a
 * row for the chute on top, one per peg row, and one for the cups. One more row of the same size
 * above the grid holds the rack of balls left; it is not a target. A tap anywhere in a column
 * drops there, so every target is a whole column. Any canvas size works.
 */
export function layoutBoard(input: LayoutInput<ToggleDropView>): BoardLayout {
  const box: Rect = {
    x: PAD,
    y: PAD,
    width: input.width - 2 * PAD,
    height: input.height - 2 * PAD,
  };
  const rows = input.view.rows + 2;
  const fitted = fitGrid({ box, cols: input.view.cols, rows: rows + RACK_ROWS });
  return {
    width: input.width,
    height: input.height,
    isMirrored: input.isMirrored,
    regions: [{ id: 'board', ...fitted, y: fitted.y + RACK_ROWS * fitted.cell, rows }],
  };
}

/** A point of the fall in board units (x across, y down; 120 per column and per row) on screen. */
export function unitPoint(region: GridRegion, x: number, y: number): { x: number; y: number } {
  return {
    x: region.x + (x / BOARD_UNITS) * region.cell,
    y: region.y + (y / BOARD_UNITS + 0.5) * region.cell,
  };
}
