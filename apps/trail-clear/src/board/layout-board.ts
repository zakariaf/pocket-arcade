// apps/trail-clear/src/board/layout-board.ts
'worklet';

import { cellRect, fitGrid } from '@e07/game-kit/geom/board-layout.ts';

import type { TrailClearView } from './to-view.ts';
import type { BoardLayout, BoardTarget, Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { LayoutInput } from '@e07/shell/game-host/board-types.ts';

/**
 * Inner padding of the canvas. S5 already sets the board 14 pt from the screen's sides, so this
 * stays small.
 */
const PAD = 4;
/** The tray's share of the height in portrait (of the width beside a wide board). */
const TRAY_SHARE = 0.2;
/** The tray never gets less than a 44 pt slot (spec S5) plus room for its selection ring. */
const TRAY_MIN_PT = 52;
/** One slot per distinct turn of the offered tile: at most four (an end, a bend, a ford...). */
export const TRAY_SLOTS = 4;
/** A tray tile fills this share of its slot at most, so the selection ring has room around it. */
const TRAY_TILE_SHARE = 0.8;
/**
 * A dragged tile's ghost (and its drop cell) sits this many points above the finger, so the thumb
 * does not hide it. The gesture layer applies it (GameBoard.dragLiftPt); this layout keeps at least
 * this much canvas below the last board row, so the edge rows stay reachable: the tray lies there
 * in portrait, and a strip of this height is kept free when the tray stands beside the board.
 */
export const DRAG_LIFT_PT = 40;
/** The board's panel reaches this far around the grid; the layout keeps the room for it. */
export const PANEL_PT = 6;

/** The box shrunk by `by` on every side. */
function shrunk(box: Rect, by: number): Rect {
  return { x: box.x + by, y: box.y + by, width: box.width - 2 * by, height: box.height - 2 * by };
}

/**
 * The tray's height in portrait: its share of the canvas, cut back so the board can take the
 * whole cell its width allows, never below TRAY_MIN_PT.
 */
function portraitTrayHeight(inner: Rect, size: number): number {
  const spare = inner.height - Math.floor(inner.width / size) * size;
  const height = Math.max(TRAY_MIN_PT, Math.min(inner.height * TRAY_SHARE, spare));
  return Math.min(inner.height, height);
}

/**
 * The 5 x 5 board, then the four-slot tray: below the board in portrait, beside it when the canvas
 * is wide. Both are tappable regions (the tray is the engine's select region).
 */
export function layoutBoard(input: LayoutInput<TrailClearView>): BoardLayout {
  const { size } = input.view;
  const isWide = input.width > input.height * 1.2;
  const inner: Rect = {
    x: PAD,
    y: PAD,
    width: input.width - 2 * PAD,
    height: input.height - 2 * PAD,
  };
  const split = isWide
    ? inner.width * (1 - TRAY_SHARE)
    : inner.height - portraitTrayHeight(inner, size);
  const boardBox = isWide
    ? { ...inner, width: split, height: inner.height - DRAG_LIFT_PT }
    : { ...inner, height: split };
  const trayBox = isWide
    ? { ...inner, x: inner.x + split, width: inner.width - split }
    : { ...inner, y: inner.y + split, height: inner.height - split };
  const board = fitGrid({ box: shrunk(boardBox, PANEL_PT), cols: size, rows: size });
  const tray = fitGrid({
    box: trayBox,
    cols: isWide ? 1 : TRAY_SLOTS,
    rows: isWide ? TRAY_SLOTS : 1,
  });
  return {
    width: input.width,
    height: input.height,
    isMirrored: input.isMirrored,
    regions: [
      { id: 'board', ...board },
      { id: 'tray', ...tray },
    ],
  };
}

/**
 * The target of tray slot `slot` that moves and pointers name (the hint, the coach, the tutorial
 * hand): they are made without a layout, so they name the slot as col + row, and trayTargetRect
 * draws it where the layout puts that slot (a row below the board, a column beside a wide one).
 */
export function traySlotTarget(slot: number): BoardTarget {
  return { regionId: 'tray', col: slot, row: 0 };
}

/** Where a tray slot is drawn and hit: slots run along the tray whichever way it lies. */
export function traySlotRect(layout: BoardLayout, slot: number): Rect | null {
  const tray = layout.regions[1];
  if (tray === undefined) return null;
  const isRow = tray.cols > 1;
  return cellRect(layout, { regionId: 'tray', col: isRow ? slot : 0, row: isRow ? 0 : slot });
}

/**
 * GameBoard.targetRect: a tray target is drawn on the slot it names (col + row, so the target
 * hit-testing returns in either layout draws on the same slot); any other target on its cell.
 */
export function trayTargetRect(layout: BoardLayout, target: BoardTarget): Rect | null {
  if (target.regionId !== 'tray') return cellRect(layout, target);
  return traySlotRect(layout, target.col + target.row);
}

/** The tile inside a tray slot: as large as a board tile, centred, at most TRAY_TILE_SHARE of it. */
export function trayTileRect(layout: BoardLayout, slot: number): Rect | null {
  const rect = traySlotRect(layout, slot);
  const board = layout.regions[0];
  if (rect === null || board === undefined) return null;
  const side = Math.min(board.cell, Math.floor(rect.width * TRAY_TILE_SHARE));
  return {
    x: rect.x + (rect.width - side) / 2,
    y: rect.y + (rect.height - side) / 2,
    width: side,
    height: side,
  };
}
