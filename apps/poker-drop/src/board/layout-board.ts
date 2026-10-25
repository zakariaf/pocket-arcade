// apps/poker-drop/src/board/layout-board.ts
'worklet';

import { fitGrid } from '@e07/game-kit/geom/board-layout.ts';

import type { PokerDropView } from './to-view.ts';
import type { BoardLayout, GridRegion, Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { LayoutInput } from '@e07/shell/game-host/board-types.ts';

/**
 * Inner padding of the canvas. S5 already sets the board 14 pt from the screen's sides, so this
 * stays small and the five columns get the width (a 362 pt phone canvas gives 68 pt columns).
 */
const PAD = 4;
/** The well's frame reaches this share of a cell past its cells on every side. */
const WELL_FRAME = 0.08;
/** The deal strip (card in hand, next card, rise counter) is this many cells deep. */
export const STRIP_CELLS = 1.5;
/** Free space between the strip's cards and the well's frame, in cells. */
const STRIP_GAP = 0.25;
/** A canvas this much wider than tall stands the strip beside the well (an iPad in landscape). */
const WIDE_RATIO = 1.2;
/** The next card is drawn smaller than the card in hand. */
const NEXT_SHARE = 0.72;
/** The rise counter: a pill one cell wide and this share of a cell tall. */
const RISE_SHARE = 0.56;

/** True when the canvas is wide enough to stand the deal strip beside the well. */
export function isWideCanvas(width: number, height: number): boolean {
  return width > height * WIDE_RATIO;
}

/**
 * The 5 x 6 well inside its frame, as large as whole-pixel square cells allow: the deal strip
 * takes STRIP_CELLS above it in portrait and beside it on a wide canvas. The well is the only
 * tappable region.
 */
export function layoutBoard(input: LayoutInput<PokerDropView>): BoardLayout {
  const { view } = input;
  const isWide = isWideCanvas(input.width, input.height);
  const box: Rect = {
    x: PAD,
    y: PAD,
    width: input.width - 2 * PAD,
    height: input.height - 2 * PAD,
  };
  const frame = 2 * WELL_FRAME;
  const grid = fitGrid({
    box,
    cols: view.cols + frame + (isWide ? STRIP_CELLS : 0),
    rows: view.rows + frame + (isWide ? 0 : STRIP_CELLS),
  });
  const inset = Math.round(WELL_FRAME * grid.cell);
  const below = isWide ? 0 : Math.round(STRIP_CELLS * grid.cell);
  return {
    width: input.width,
    height: input.height,
    isMirrored: input.isMirrored,
    regions: [
      {
        id: 'well',
        cell: grid.cell,
        x: grid.x + inset,
        y: grid.y + below + inset,
        cols: view.cols,
        rows: view.rows,
      },
    ],
  };
}

/** Before the canvas has a size there is no region: an empty well, so nothing is drawn. */
const NO_WELL: GridRegion = { id: 'well', x: 0, y: 0, cell: 0, cols: 0, rows: 0 };

/** The well's region (an empty one before the canvas has a size). */
export function wellRegion(layout: BoardLayout): GridRegion {
  return layout.regions[0] ?? NO_WELL;
}

/** The well's frame: its cells and the margin around them that layoutBoard keeps inside the canvas. */
export function wellFrame(layout: BoardLayout): Rect {
  const well = wellRegion(layout);
  const inset = Math.round(WELL_FRAME * well.cell);
  return {
    x: well.x - inset,
    y: well.y - inset,
    width: well.cols * well.cell + 2 * inset,
    height: well.rows * well.cell + 2 * inset,
  };
}

/** Where a card at (col, row) is drawn, rows counted from the bottom as in the rules (fractions animate). */
export function wellCellRect(
  layout: BoardLayout,
  at: { readonly col: number; readonly row: number },
): Rect {
  const well = wellRegion(layout);
  const x = well.x + at.col * well.cell;
  return {
    // Mirrored as game-kit's cellRect mirrors (positions, never pixels).
    x: layout.isMirrored ? layout.width - x - well.cell : x,
    y: well.y + (well.rows - 1 - at.row) * well.cell,
    width: well.cell,
    height: well.cell,
  };
}

/** The deal strip's three places, each a square slot (the rise pill a short bar). */
export type DealRects = { readonly hand: Rect; readonly next: Rect; readonly rise: Rect };

function square(x: number, y: number, size: number): Rect {
  return { x, y, width: size, height: size };
}

/**
 * Portrait: above the well, the next card over the first column, the card in hand over the middle
 * one, the rise counter over the last. Wide: in a column beside the well, top to bottom.
 */
export function dealRects(layout: BoardLayout): DealRects {
  const well = wellRegion(layout);
  const box = wellFrame(layout);
  const c = well.cell;
  const nextInset = (c * (1 - NEXT_SHARE)) / 2;
  const riseHeight = c * RISE_SHARE;
  const centring = (STRIP_CELLS - STRIP_GAP - 1) * c * 0.5;
  if (isWideCanvas(layout.width, layout.height)) {
    const x = box.x + box.width + STRIP_GAP * c + centring;
    return {
      hand: square(x, well.y, c),
      next: square(x + nextInset, well.y + 1.25 * c + nextInset, c * NEXT_SHARE),
      rise: { x, y: well.y + 2.5 * c, width: c, height: riseHeight },
    };
  }
  const top = box.y - STRIP_CELLS * c + centring;
  return {
    hand: square(well.x + 2 * c, top, c),
    next: square(well.x + nextInset, top + nextInset, c * NEXT_SHARE),
    rise: {
      x: well.x + (well.cols - 1) * c,
      y: top + (c - riseHeight) / 2,
      width: c,
      height: riseHeight,
    },
  };
}
