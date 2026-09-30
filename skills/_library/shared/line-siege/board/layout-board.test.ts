// apps/line-siege/src/board/layout-board.test.ts
import fc from 'fast-check';

import { cellRect, hitTest } from '@e07/game-kit/geom/board-layout.ts';

import { DRAG_LIFT_PT, lanePoint, layoutBoard, traySlotRect, wallRect } from './layout-board.ts';

import type { LineSiegeView } from './to-view.ts';
import type { BoardLayout, GridRegion } from '@e07/game-kit/geom/board-layout.ts';

const VIEW: LineSiegeView = {
  size: 8,
  laneRows: 6,
  cells: Array.from({ length: 64 }, () => 0),
  monsters: [],
  tray: [[0, 0], [], [0, 0, 1, 0]],
  hearts: 3,
  maxHearts: 3,
};

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
  it('keeps board and tray inside the canvas and hit-tests every cell centre back to itself', () => {
    fc.assert(
      fc.property(
        fc.record({
          width: fc.integer({ min: 240, max: 2732 }),
          height: fc.integer({ min: 240, max: 2732 }),
          isMirrored: fc.boolean(),
        }),
        ({ width, height, isMirrored }) => {
          const layout = layoutBoard({ width, height, view: VIEW, isMirrored });
          for (const region of layout.regions) expectRegionRoundTrip(layout, region);
        },
      ),
      { seed: 19, numRuns: 120 },
    );
  });

  it('keeps the far end of every lane inside the canvas, above the board', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 240, max: 2732 }),
        fc.integer({ min: 240, max: 2732 }),
        (width, height) => {
          const layout = layoutBoard({ width, height, view: VIEW, isMirrored: false });
          const far = lanePoint(layout, VIEW, { lane: 7, row: 0 });
          const top = cellRect(layout, { regionId: 'board', col: 7, row: 0 });
          expect(far !== null && far.y - far.step / 2 >= 0).toBe(true);
          expect(far !== null && top !== null && far.y < top.y).toBe(true);
        },
      ),
      { seed: 23, numRuns: 120 },
    );
  });

  it('puts the wall between the last lane row and the board', () => {
    const layout = layoutBoard({ width: 390, height: 560, view: VIEW, isMirrored: false });
    const wall = wallRect(layout, VIEW);
    const near = lanePoint(layout, VIEW, { lane: 0, row: 5 });
    const top = cellRect(layout, { regionId: 'board', col: 0, row: 0 });
    expect(wall !== null && near !== null && near.y + near.step / 2).toBeCloseTo(wall?.y ?? 0);
    expect(wall !== null && top !== null && wall.y + wall.height).toBeCloseTo(top?.y ?? 0);
  });

  it('keeps at least the drag lift free below the board when the tray stands beside it', () => {
    fc.assert(
      fc.property(fc.integer({ min: 300, max: 1400 }), (height) => {
        const width = Math.round(height * 1.6);
        const layout = layoutBoard({ width, height, view: VIEW, isMirrored: false });
        const last = cellRect(layout, { regionId: 'board', col: 0, row: 7 });
        expect(last !== null && height - (last.y + last.height)).toBeGreaterThanOrEqual(
          DRAG_LIFT_PT,
        );
      }),
      { seed: 29, numRuns: 80 },
    );
  });

  it('moves the tray beside the board on wide canvases and finds each slot either way', () => {
    const wide = layoutBoard({ width: 1024, height: 700, view: VIEW, isMirrored: false });
    const tall = layoutBoard({ width: 390, height: 560, view: VIEW, isMirrored: false });
    expect([wide.regions[1]?.cols, wide.regions[1]?.rows]).toStrictEqual([1, 3]);
    expect(traySlotRect(wide, 2)).toStrictEqual(
      cellRect(wide, { regionId: 'tray', col: 0, row: 2 }),
    );
    expect(traySlotRect(tall, 2)).toStrictEqual(
      cellRect(tall, { regionId: 'tray', col: 2, row: 0 }),
    );
  });

  it('has no slots or lanes before the canvas has regions', () => {
    const empty = { width: 0, height: 0, isMirrored: false, regions: [] };
    const nothing = [traySlotRect(empty, 0), lanePoint(empty, VIEW, { lane: 0, row: 0 })];
    expect([...nothing, wallRect(empty, VIEW)]).toStrictEqual([null, null, null]);
  });
});
