// apps/poker-drop/src/board/hit-targets.test.ts
import { hitTest } from '@e07/game-kit/geom/board-layout.ts';

import { EMPTY_CELL } from './board-ids.ts';
import { layoutBoard } from './layout-board.ts';

import type { PokerDropView } from './to-view.ts';

/** Touch targets on boards are at least 44 pt (an exception needs the owner's sign-off). */
const MIN_TOUCH_PT = 44;
/** Board area on a 402 × 874 pt phone: 374 pt wide (14 pt side margins); 660 pt tall is below the
 * Toybox S5 area (708 pt), leaving room for a taller top bar at large text sizes. */
const PHONE_BOARD = { width: 374, height: 660 };
/** The S5 canvases of the phones the spec names, and the smallest supported one (375 × 667 pt). */
const PHONES = [
  { width: 362, height: 640 },
  { width: 365, height: 650 },
  { width: 374, height: 660 },
  { width: 347, height: 480 },
];
/** The well is the same 5 × 6 grid at every level (spec 13: a 5-column well). */
const LARGEST_VIEW: PokerDropView = {
  cols: 5,
  rows: 6,
  cells: Array.from({ length: 30 }, () => EMPTY_CELL),
  hand: 0,
  next: 1,
  riseDrops: 8,
  riseText: '8',
  stepTexts: [],
};

describe('board hit targets', () => {
  // spec S5 and 8.11: every touch target is at least 44 x 44 pt.
  it('keeps every hit region at least 44 pt on a 402 × 874 pt phone', () => {
    const layout = layoutBoard({ ...PHONE_BOARD, view: LARGEST_VIEW, isMirrored: false });
    const smallest = Math.min(...layout.regions.map((region) => region.cell));
    expect(smallest).toBeGreaterThanOrEqual(MIN_TOUCH_PT);
  });

  it('keeps the columns at least 44 pt on every phone canvas, the smallest phone included', () => {
    const cells = PHONES.map(
      (size) => layoutBoard({ ...size, view: LARGEST_VIEW, isMirrored: false }).regions[0]?.cell,
    );
    expect(cells.every((cell) => (cell ?? 0) >= MIN_TOUCH_PT)).toBe(true);
  });

  it('lands a tap on the top and the bottom cell of every column in that column', () => {
    const layout = layoutBoard({ ...PHONE_BOARD, view: LARGEST_VIEW, isMirrored: false });
    const well = layout.regions[0];
    if (well === undefined) throw new Error('the well has no region');
    const hits = [0, 1, 2, 3, 4].flatMap((col) =>
      [1, well.rows * well.cell - 1].map((dy) =>
        hitTest(layout, { x: well.x + (col + 0.5) * well.cell, y: well.y + dy }, 8),
      ),
    );
    expect(hits.map((hit) => hit?.col)).toStrictEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
});
