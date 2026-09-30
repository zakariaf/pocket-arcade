// apps/line-siege/src/board/layout-board.ts
'worklet';

import { cellRect, fitGrid } from '@e07/game-kit/geom/board-layout.ts';

import type { LineSiegeView } from './to-view.ts';
import type { BoardLayout, Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { LayoutInput } from '@e07/shell/game-host/board-types.ts';

const PAD = 8;
const TRAY_SHARE = 0.2;
const TRAY_SLOTS = 3;
/** The wall between the lanes and the board is half a cell tall; the hearts sit on it. */
export const WALL_CELLS = 0.5;
/**
 * A dragged block's ghost (and its drop cell) sits this many points above the finger, so the thumb
 * does not hide it. The gesture layer applies it (GameBoard.dragLiftPt); this layout keeps at least
 * this much canvas below the last board row, so the edge rows stay reachable: the tray lies there
 * in portrait, and a strip of this height is kept free when the tray stands beside the board.
 */
export const DRAG_LIFT_PT = 40;

/** The lanes above the board take half a cell per lane row. */
export function laneBandCells(laneRows: number): number {
  return Math.ceil(laneRows / 2);
}

/**
 * Lanes, the wall, the 8x8 board, then the 3-slot tray: the tray sits below in portrait and
 * beside the board when the canvas is wide. Only the board and the tray are tappable regions.
 */
export function layoutBoard(input: LayoutInput<LineSiegeView>): BoardLayout {
  const { view } = input;
  const isWide = input.width > input.height * 1.2;
  const inner: Rect = {
    x: PAD,
    y: PAD,
    width: input.width - 2 * PAD,
    height: input.height - 2 * PAD,
  };
  const split = isWide ? inner.width * (1 - TRAY_SHARE) : inner.height * (1 - TRAY_SHARE);
  const stackBox = isWide
    ? { ...inner, width: split, height: inner.height - DRAG_LIFT_PT }
    : { ...inner, height: split };
  const trayBox = isWide
    ? { ...inner, x: inner.x + split, width: inner.width - split }
    : { ...inner, y: inner.y + split, height: inner.height - split };
  const above = laneBandCells(view.laneRows) + WALL_CELLS;
  const stack = fitGrid({ box: stackBox, cols: view.size, rows: view.size + above });
  const tray = fitGrid({
    box: trayBox,
    cols: isWide ? 1 : TRAY_SLOTS,
    rows: isWide ? TRAY_SLOTS : 1,
  });
  const board = {
    id: 'board',
    ...stack,
    y: Math.round(stack.y + above * stack.cell),
    rows: view.size,
  };
  return {
    width: input.width,
    height: input.height,
    isMirrored: input.isMirrored,
    regions: [board, { id: 'tray', ...tray }],
  };
}

/** Where a tray slot is drawn and hit: slots run along the tray whichever way it lies. */
export function traySlotRect(layout: BoardLayout, slot: number): Rect | null {
  const tray = layout.regions[1];
  if (tray === undefined) return null;
  const isRow = tray.cols > 1;
  return cellRect(layout, { regionId: 'tray', col: isRow ? slot : 0, row: isRow ? 0 : slot });
}

/** The wall: the band between the last lane row and the board's first row. */
export function wallRect(layout: BoardLayout, view: LineSiegeView): Rect | null {
  const first = cellRect(layout, { regionId: 'board', col: 0, row: 0 });
  if (first === null) return null;
  const height = first.height * WALL_CELLS;
  return { x: first.x, y: first.y - height, width: first.width * view.size, height };
}

/** Centre of lane `lane` at lane row `row` (fractional rows animate; laneRows = in the wall). */
export function lanePoint(
  layout: BoardLayout,
  view: LineSiegeView,
  at: { readonly lane: number; readonly row: number },
): { readonly x: number; readonly y: number; readonly step: number } | null {
  const top = cellRect(layout, { regionId: 'board', col: at.lane, row: 0 });
  if (top === null) return null;
  const step = (top.height * laneBandCells(view.laneRows)) / view.laneRows;
  const wallTop = top.y - top.height * WALL_CELLS;
  return { x: top.x + top.width / 2, y: wallTop - (view.laneRows - at.row - 0.5) * step, step };
}
