// apps/flock-tilt/src/board/hit-targets.test.ts
import { layoutBoard } from './layout-board.ts';

import type { FlockTiltView } from './to-view.ts';

/** Touch targets on boards are at least 44 pt (an exception needs the owner's sign-off). */
const MIN_TOUCH_PT = 44;
/** Board area on a 402 × 874 pt phone: 374 pt wide (14 pt side margins); 660 pt tall is below the
 * Toybox S5 area (708 pt), leaving room for a taller top bar at large text sizes. */
const PHONE_BOARD = { width: 374, height: 660 };
/** The largest grid the game ever shows: every field is 7 × 7, beside its four 1 × 1 tilt keys. */
const LARGEST_VIEW: FlockTiltView = {
  cols: 7,
  rows: 7,
  rocks: [],
  pen: 48,
  sheep: [],
  wolves: [],
  pennedText: '0',
  pennedCount: 0,
};

describe('board hit targets', () => {
  it('keeps every hit region at least 44 pt on a 402 × 874 pt phone', () => {
    const layout = layoutBoard({ ...PHONE_BOARD, view: LARGEST_VIEW, isMirrored: false });
    const smallest = Math.min(...layout.regions.map((region) => region.cell));
    expect(smallest).toBeGreaterThanOrEqual(MIN_TOUCH_PT);
  });
});
