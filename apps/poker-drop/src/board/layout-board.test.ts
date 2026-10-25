// apps/poker-drop/src/board/layout-board.test.ts
import fc from 'fast-check';

import { cellRect, hitTest } from '@e07/game-kit/geom/board-layout.ts';

import { EMPTY_CELL } from './board-ids.ts';
import { dealRects, layoutBoard, wellCellRect, wellFrame } from './layout-board.ts';

import type { PokerDropView } from './to-view.ts';
import type { Rect } from '@e07/game-kit/geom/board-layout.ts';

const VIEW: PokerDropView = {
  cols: 5,
  rows: 6,
  cells: Array.from({ length: 30 }, () => EMPTY_CELL),
  hand: 0,
  next: 1,
  riseDrops: 3,
  riseText: '3',
  stepTexts: [],
};

const isInside = (rect: Rect, size: { readonly width: number; readonly height: number }) =>
  rect.x >= 0 &&
  rect.y >= 0 &&
  rect.x + rect.width <= size.width &&
  rect.y + rect.height <= size.height;
const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** True when every well cell sits inside the canvas and hit-tests its centre back to itself. */
function cellsRoundTrip(
  size: { readonly width: number; readonly height: number },
  isMirrored: boolean,
) {
  const layout = layoutBoard({ ...size, view: VIEW, isMirrored });
  for (let row = 0; row < VIEW.rows; row += 1) {
    for (let col = 0; col < VIEW.cols; col += 1) {
      const rect = cellRect(layout, { regionId: 'well', col, row });
      if (rect === null || !isInside(rect, size)) return false;
      const centre = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      if (
        JSON.stringify(hitTest(layout, centre)) !== JSON.stringify({ regionId: 'well', col, row })
      ) {
        return false;
      }
    }
  }
  return true;
}

/** True when the well's frame, the hand, next and rise rects sit inside the canvas, the strip clear of the well. */
function dealClearOfWell(size: { readonly width: number; readonly height: number }) {
  const layout = layoutBoard({ ...size, view: VIEW, isMirrored: false });
  const deal = dealRects(layout);
  const well = layout.regions[0];
  if (well === undefined) return false;
  const wellRect = {
    x: well.x,
    y: well.y,
    width: well.cols * well.cell,
    height: well.rows * well.cell,
  };
  const isStripClear = [deal.hand, deal.next, deal.rise].every(
    (rect) => isInside(rect, size) && !overlaps(rect, wellRect),
  );
  return isStripClear && isInside(wellFrame(layout), size);
}

describe('layoutBoard', () => {
  it('keeps every well cell inside the canvas and hit-tests its centre back to itself, at any size', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 240, max: 2732 }),
        fc.integer({ min: 240, max: 2732 }),
        fc.boolean(),
        (width, height, isMirrored) => {
          expect(cellsRoundTrip({ width, height }, isMirrored)).toBe(true);
        },
      ),
      { seed: 17, numRuns: 150 },
    );
  });

  it('puts the deal strip inside the canvas and clear of the well, at any size', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 240, max: 2732 }),
        fc.integer({ min: 240, max: 2732 }),
        (width, height) => {
          expect(dealClearOfWell({ width, height })).toBe(true);
        },
      ),
      { seed: 19, numRuns: 150 },
    );
  });

  it('pins the phone layout: 72 pt cells with the deal strip above the framed well', () => {
    const layout = layoutBoard({ width: 390, height: 560, view: VIEW, isMirrored: false });
    expect(layout.regions).toStrictEqual([
      { id: 'well', x: 15, y: 118, cell: 72, cols: 5, rows: 6 },
    ]);
    expect(dealRects(layout).hand).toStrictEqual({ x: 159, y: 13, width: 72, height: 72 });
  });

  it('stands the deal strip beside the well on a wide canvas instead of shrinking the well', () => {
    const layout = layoutBoard({ width: 1024, height: 700, view: VIEW, isMirrored: false });
    const well = layout.regions[0];
    const deal = dealRects(layout);
    expect(well?.cell).toBe(112);
    expect(deal.hand.x).toBeGreaterThan((well?.x ?? 0) + 5 * (well?.cell ?? 0));
  });

  it('mirrors positions (not pixels) when asked to', () => {
    const layout = layoutBoard({ width: 400, height: 600, view: VIEW, isMirrored: true });
    const first = cellRect(layout, { regionId: 'well', col: 0, row: 0 });
    expect(first === null ? 0 : first.x + first.width).toBeGreaterThan(300);
  });

  it('gives the deal strip no room before the canvas has a size', () => {
    const deal = dealRects({ width: 0, height: 0, isMirrored: false, regions: [] });
    expect([deal.hand.width, deal.next.width, deal.rise.width]).toStrictEqual([0, 0, 0]);
  });
});

describe('wellCellRect', () => {
  it('counts rows from the bottom as the rules do, fractional rows included', () => {
    const layout = layoutBoard({ width: 390, height: 560, view: VIEW, isMirrored: false });
    expect(wellCellRect(layout, { col: 0, row: 0 })).toStrictEqual({
      x: 15,
      y: 478,
      width: 72,
      height: 72,
    });
    expect(wellCellRect(layout, { col: 4, row: 5.5 }).y).toBe(82);
    const empty = { width: 0, height: 0, isMirrored: false, regions: [] };
    expect(wellCellRect(empty, { col: 0, row: 0 }).width).toBe(0);
  });

  it('mirrors a cell exactly as the game kit mirrors it', () => {
    const layout = layoutBoard({ width: 400, height: 600, view: VIEW, isMirrored: true });
    expect(wellCellRect(layout, { col: 1, row: 5 })).toStrictEqual(
      cellRect(layout, { regionId: 'well', col: 1, row: 0 }),
    );
  });
});
