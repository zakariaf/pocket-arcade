// apps/stepstone/src/board/hit-targets.test.ts
// Spec S5 and 8.11: every touch target on the board is at least 44 × 44 pt, playable with one finger.
import { layoutBoard } from './layout-board.ts';

import type { StepstoneView } from './to-view.ts';

/** Touch targets on boards are at least 44 pt (an exception needs the owner's sign-off). */
const MIN_TOUCH_PT = 44;
/** Board area on a 402 × 874 pt phone: 374 pt wide (14 pt side margins); 660 pt tall is below the
 * Toybox S5 area (708 pt), leaving room for a taller top bar at large text sizes. */
const PHONE_BOARD = { width: 374, height: 660 };
/** The largest pond the game ever shows (its hardest tuning row): 7 × 7. */
const LARGEST_VIEW: StepstoneView = {
  side: 7,
  cells: Array.from({ length: 49 }, () => 0),
  frog: 0,
  reach: [],
  movesText: '0',
};

describe('board hit targets', () => {
  it('keeps every hit region at least 44 pt on a 402 × 874 pt phone', () => {
    const layout = layoutBoard({ ...PHONE_BOARD, view: LARGEST_VIEW, isMirrored: false });
    const smallest = Math.min(...layout.regions.map((region) => region.cell));
    expect(smallest).toBeGreaterThanOrEqual(MIN_TOUCH_PT);
  });
});
