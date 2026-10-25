// apps/swap-guard/src/board/hit-targets.test.ts
// Spec S5 and 8.11: every touch target is at least 44 x 44 pt.
import { layoutBoard } from './layout-board.ts';

import type { SwapGuardView } from './to-view.ts';

/** Touch targets on boards are at least 44 pt (an exception needs the owner's sign-off). */
const MIN_TOUCH_PT = 44;
/** Board area on a 402 × 874 pt phone: 374 pt wide (14 pt side margins), 660 pt tall. */
const PHONE_BOARD = { width: 374, height: 660 };
/** The largest grid the game ever shows (the two hardest tuning rows): 6 × 6. */
const LARGEST_VIEW: SwapGuardView = {
  size: 6,
  guard: 0,
  enemies: [],
  fallen: [],
  marks: [],
  swapsLeftText: '0',
  swapsLeft: 0,
  maxSwaps: 18,
  defeated: 0,
  total: 6,
  isHit: false,
};

describe('board hit targets', () => {
  it('keeps every hit region at least 44 pt on a 402 × 874 pt phone', () => {
    const layout = layoutBoard({ ...PHONE_BOARD, view: LARGEST_VIEW, isMirrored: false });
    const smallest = Math.min(...layout.regions.map((region) => region.cell));
    expect(smallest).toBeGreaterThanOrEqual(MIN_TOUCH_PT);
  });
});
