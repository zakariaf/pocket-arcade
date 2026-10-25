// apps/flock-tilt/src/board/hit-targets.test.ts
import { cellRect, hitTest } from '@e07/game-kit/geom/board-layout.ts';

import { TILT_KEY_REGIONS } from './board-ids.ts';
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

  it('keeps every tilt key a 44 pt target on a short screen, where the field cells are smaller', () => {
    // A 420 pt tall board (a small phone with a tall top bar): the field's cells drop below 44 pt.
    const layout = layoutBoard({ width: 374, height: 420, view: LARGEST_VIEW, isMirrored: false });
    const targets = Object.values(TILT_KEY_REGIONS).map((regionId) => {
      const rect = cellRect(layout, { regionId, col: 0, row: 0 }) ?? {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      };
      const centre = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      return {
        regionId,
        isLarge: Math.min(rect.width, rect.height) >= MIN_TOUCH_PT,
        hit: hitTest(layout, centre)?.regionId,
      };
    });
    expect(targets).toStrictEqual(
      Object.values(TILT_KEY_REGIONS).map((regionId) => ({
        regionId,
        isLarge: true,
        hit: regionId,
      })),
    );
  });
});
