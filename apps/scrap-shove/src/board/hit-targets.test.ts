// apps/scrap-shove/src/board/hit-targets.test.ts
import { layoutBoard } from './layout-board.ts';

import type { ScrapShoveView } from './to-view.ts';

/** Touch targets on boards are at least 44 pt (S5, spec 8.11). */
const MIN_TOUCH_PT = 44;
/** Board area on a 402 × 874 pt phone: 374 pt wide (14 pt side margins); 660 pt tall is below the
 * Toybox S5 area (708 pt), leaving room for a taller top bar at large text sizes. */
const PHONE_BOARD = { width: 374, height: 660 };
/** The largest floor the game ever shows: every level and the daily are 8 × 8. */
const LARGEST_VIEW: ScrapShoveView = {
  cols: 8,
  rows: 8,
  player: { col: 0, row: 0 },
  robots: [],
  heaps: [],
  isCaught: false,
  scrapped: 0,
  total: 0,
  countTexts: ['0'],
};

describe('board hit targets', () => {
  it('keeps every square at least 44 pt on a 402 × 874 pt phone', () => {
    const layout = layoutBoard({ ...PHONE_BOARD, view: LARGEST_VIEW, isMirrored: false });
    const smallest = Math.min(...layout.regions.map((region) => region.cell));
    expect(smallest).toBeGreaterThanOrEqual(MIN_TOUCH_PT);
  });
});
