// apps/snare-snake/src/board/hit-targets.test.ts
// Spec S5 and 8.11: every touch target is at least 44 x 44 pt.
import { layoutBoard } from './layout-board.ts';

import type { SnareSnakeView } from './to-view.ts';

/** Touch targets on boards are at least 44 pt (an exception needs the owner's sign-off). */
const MIN_TOUCH_PT = 44;
/** Board area on a 402 × 874 pt phone: 374 pt wide (14 pt side margins); 660 pt tall is below the
 * Toybox S5 area (708 pt), leaving room for a taller top bar at large text sizes. */
const PHONE_BOARD = { width: 374, height: 660 };
/** The largest grid the game ever shows (the hardest tuning row): 8 × 10. */
const LARGEST_VIEW: SnareSnakeView = {
  cols: 8,
  rows: 10,
  snake: [0],
  heading: 'right',
  critters: [],
  movesLeftText: '0',
  movesLeft: 0,
  caught: 0,
  total: 0,
};

describe('board hit targets', () => {
  it('keeps every hit region at least 44 pt on a 402 × 874 pt phone', () => {
    const layout = layoutBoard({ ...PHONE_BOARD, view: LARGEST_VIEW, isMirrored: false });
    const smallest = Math.min(...layout.regions.map((region) => region.cell));
    expect(smallest).toBeGreaterThanOrEqual(MIN_TOUCH_PT);
  });
});
