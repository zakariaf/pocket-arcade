// apps/trail-clear/src/board/layout-board.test.ts
// Spec S5 and 8.11: every touch target is at least 44 x 44 pt, and the whole game is playable with
// one finger in portrait. The layout is a pure function of the canvas size, shared by draw and touch.
import fc from 'fast-check';

import { cellRect, hitTest } from '@e07/game-kit/geom/board-layout.ts';

import {
  DRAG_LIFT_PT,
  PANEL_PT,
  TRAY_SLOTS,
  layoutBoard,
  trayTileRect,
  traySlotRect,
} from './layout-board.ts';

import type { TrailClearView } from './to-view.ts';
import type { BoardLayout, GridRegion } from '@e07/game-kit/geom/board-layout.ts';

const MIN_TOUCH_PT = 44;
const VIEW: TrailClearView = {
  size: 5,
  cells: Array.from({ length: 25 }, () => []),
  tray: [],
  wipes: [],
  pointsText: [],
};
/**
 * Board canvases S5 leaves: the screen minus the status bar, the game top bar (60 pt) and the
 * board margins 4 / 14 / 40 (top / sides / bottom): a 402 x 874 pt phone, a 375 x 667 pt phone
 * (home button, 20 pt status bar) and an iPad in landscape (1366 x 1024 pt, 24 pt status bar).
 */
const CANVASES = [
  { device: '402 x 874 phone', width: 402 - 28, height: 874 - 62 - 60 - 44 },
  { device: '375 x 667 phone', width: 375 - 28, height: 667 - 20 - 60 - 44 },
  { device: '1366 x 1024 tablet in landscape', width: 1366 - 28, height: 1024 - 24 - 60 - 44 },
];

/** The value, or a thrown error when the layout has no such part. */
function present<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('missing layout part');
  return value;
}

/** Every cell of `region` lies inside the canvas and its centre hit-tests back to itself. */
function expectRegionRoundTrip(layout: BoardLayout, region: GridRegion): void {
  for (let i = 0; i < region.cols * region.rows; i += 1) {
    const target = { regionId: region.id, col: i % region.cols, row: Math.floor(i / region.cols) };
    const rect = cellRect(layout, target);
    if (rect === null) throw new Error('missing cell');
    expect(rect.x >= 0 && rect.x + rect.width <= layout.width).toBe(true);
    expect(rect.y >= 0 && rect.y + rect.height <= layout.height).toBe(true);
    const centre = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    expect(hitTest(layout, centre)).toStrictEqual(target);
  }
}

describe('layoutBoard', () => {
  it('keeps the board and the tray inside the canvas and hit-tests every centre back, at any size', () => {
    fc.assert(
      fc.property(
        fc.record({
          width: fc.integer({ min: 240, max: 2732 }),
          height: fc.integer({ min: 240, max: 2732 }),
          isMirrored: fc.boolean(),
        }),
        ({ width, height, isMirrored }) => {
          const layout = layoutBoard({ width, height, view: VIEW, isMirrored });
          expect(layout.regions.map((region) => region.id)).toStrictEqual(['board', 'tray']);
          for (const region of layout.regions) expectRegionRoundTrip(layout, region);
        },
      ),
      { seed: 28, numRuns: 120 },
    );
  });

  it('leaves room around the grid for the board panel, inside the canvas and clear of the tray, at any size', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 240, max: 2732 }),
        fc.integer({ min: 240, max: 2732 }),
        (width, height) => {
          const layout = layoutBoard({ width, height, view: VIEW, isMirrored: false });
          const board = present(layout.regions[0]);
          const tray = present(layout.regions[1]);
          const side = board.cell * board.cols;
          const panel = {
            left: board.x - PANEL_PT,
            top: board.y - PANEL_PT,
            right: board.x + side + PANEL_PT,
            bottom: board.y + side + PANEL_PT,
          };
          const isInside =
            panel.left >= 0 && panel.top >= 0 && panel.right <= width && panel.bottom <= height;
          const isClearOfTray = panel.bottom <= tray.y || panel.right <= tray.x;
          expect([isInside, isClearOfTray]).toStrictEqual([true, true]);
        },
      ),
      { seed: 31, numRuns: 120 },
    );
  });

  it.each(CANVASES)('gives cells and tray slots of at least 44 pt on a $device', (canvas) => {
    const layout = layoutBoard({ ...canvas, view: VIEW, isMirrored: false });
    expect(layout.regions.map((region) => [region.id, region.cell >= MIN_TOUCH_PT])).toStrictEqual([
      ['board', true],
      ['tray', true],
    ]);
  });

  it('keeps at least the drag lift free below the board when the tray stands beside it', () => {
    fc.assert(
      fc.property(fc.integer({ min: 300, max: 1400 }), (height) => {
        const width = Math.round(height * 1.6);
        const layout = layoutBoard({ width, height, view: VIEW, isMirrored: false });
        const last = cellRect(layout, { regionId: 'board', col: 0, row: 4 });
        expect(last !== null && height - (last.y + last.height)).toBeGreaterThanOrEqual(
          DRAG_LIFT_PT,
        );
      }),
      { seed: 29, numRuns: 80 },
    );
  });

  it('lays the four tray slots in a row below the board, or in a column beside it when wide', () => {
    const tall = layoutBoard({ width: 390, height: 560, view: VIEW, isMirrored: false });
    const wide = layoutBoard({ width: 1024, height: 700, view: VIEW, isMirrored: false });
    expect(TRAY_SLOTS).toBe(4);
    expect([
      tall.regions[1]?.cols,
      tall.regions[1]?.rows,
      wide.regions[1]?.cols,
      wide.regions[1]?.rows,
    ]).toStrictEqual([4, 1, 1, 4]);
    expect(traySlotRect(tall, 3)).toStrictEqual(
      cellRect(tall, { regionId: 'tray', col: 3, row: 0 }),
    );
    expect(traySlotRect(wide, 3)).toStrictEqual(
      cellRect(wide, { regionId: 'tray', col: 0, row: 3 }),
    );
  });

  it('draws a tray tile as large as a board tile, centred in its slot, when the slot allows', () => {
    const layout = layoutBoard({ width: 374, height: 708, view: VIEW, isMirrored: false });
    const board = present(layout.regions[0]).cell;
    const slot = present(traySlotRect(layout, 1));
    const tile = present(trayTileRect(layout, 1));
    expect(tile.width).toBe(Math.min(board, Math.floor(slot.width * 0.8)));
    expect(tile.x + tile.width / 2).toBeCloseTo(slot.x + slot.width / 2);
    expect(tile.y + tile.height / 2).toBeCloseTo(slot.y + slot.height / 2);
  });

  it('has no slots before the canvas has regions', () => {
    const empty = { width: 0, height: 0, isMirrored: false, regions: [] };
    expect([traySlotRect(empty, 0), trayTileRect(empty, 0)]).toStrictEqual([null, null]);
  });
});
