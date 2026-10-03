// apps/line-siege/src/board/hit-targets.test.ts
import { cellRect, hitTest } from '@e07/game-kit/geom/board-layout.ts';
import { HIT_SLOP, liftedPoint } from '@e07/shell/game-host/pan-intent.ts';

import { DRAG_LIFT_PT, layoutBoard } from './layout-board.ts';

import type { LineSiegeView } from './to-view.ts';
import type { BoardLayout, BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

/** Touch targets on boards are at least 44 pt (an exception needs the owner's sign-off). */
const MIN_TOUCH_PT = 44;
/** Board area on a 402 × 874 pt phone: 374 pt wide (14 pt side margins); 660 pt tall is below the
 * Toybox S5 area (708 pt), leaving room for a taller top bar at large text sizes. */
const PHONE_BOARD = { width: 374, height: 660 };
/**
 * The board canvas S5 leaves on common phones: the screen minus the status bar, the Toybox game top
 * bar (padding 4 + 48 pt pause key + 8 = 60 pt) and the board margins 4 / 14 / 40 (top / sides /
 * bottom, fixed by the design). Status bars: 54 pt on the 390 × 844 design phone, 62 pt on the
 * 402 × 874 parity phone, 59 pt on a 393 × 852 phone and 20 pt on a 375 × 667 phone (home button).
 */
const PHONES = [
  { phone: '390 × 844', width: 390 - 28, height: 844 - 54 - 60 - 44 },
  { phone: '393 × 852', width: 393 - 28, height: 852 - 59 - 60 - 44 },
  { phone: '402 × 874', width: 402 - 28, height: 874 - 62 - 60 - 44 },
];
/**
 * A 375 × 667 phone leaves a 347 × 543 pt canvas: 8 cells of 44 pt need 352 pt, more than the
 * design's 14 pt side margins leave, so its board gets the largest whole cell its width allows
 * (an exception to the 44 pt rule needs the owner's sign-off).
 */
const SMALL_PHONE = { width: 375 - 28, height: 667 - 20 - 60 - 44 };
/** Wide canvases: the tray stands beside the board (a phone on its side, an iPad in landscape). */
const WIDE_BOARDS = [
  { width: 820, height: 420 },
  { width: 1024, height: 700 },
];
/** Line Siege's largest view: the 8 × 8 board under 6 lane rows, plus the 3-slot tray. */
const LARGEST_VIEW: LineSiegeView = {
  size: 8,
  laneRows: 6,
  cells: Array.from({ length: 64 }, () => 0),
  monsters: [],
  tray: [[], [], []],
  hearts: 3,
  maxHearts: 3,
};

/** True when some finger position inside the canvas, lifted like a drag, lands on `target`. */
function isReachableByDrag(layout: BoardLayout, target: BoardTarget): boolean {
  const rect = cellRect(layout, target);
  if (rect === null) return false;
  const x = rect.x + rect.width / 2;
  for (let y = 0; y <= layout.height; y += 1) {
    const hit = hitTest(layout, liftedPoint({ x, y }, DRAG_LIFT_PT), HIT_SLOP);
    if (hit?.regionId === target.regionId && hit.col === target.col && hit.row === target.row) {
      return true;
    }
  }
  return false;
}

/** Every cell of the first and the last board row. */
function edgeCells(): BoardTarget[] {
  return [0, 7].flatMap((row) =>
    Array.from({ length: 8 }, (_, col) => ({ regionId: 'board', col, row })),
  );
}

describe('line siege hit targets', () => {
  it('keeps board cells and tray slots at least 44 pt on a 402 × 874 pt phone', () => {
    const layout = layoutBoard({ ...PHONE_BOARD, view: LARGEST_VIEW, isMirrored: false });
    expect(layout.regions.map((region) => [region.id, region.cell >= MIN_TOUCH_PT])).toStrictEqual([
      ['board', true],
      ['tray', true],
    ]);
  });

  it.each(PHONES)(
    'keeps board cells and tray slots at least 44 pt on the S5 canvas of a $phone pt phone (S5 rule)',
    (size) => {
      const layout = layoutBoard({ ...size, view: LARGEST_VIEW, isMirrored: false });
      expect(
        layout.regions.map((region) => [region.id, region.cell >= MIN_TOUCH_PT]),
      ).toStrictEqual([
        ['board', true],
        ['tray', true],
      ]);
      expect(edgeCells().filter((cell) => !isReachableByDrag(layout, cell))).toStrictEqual([]);
    },
  );

  it('gives a 375 × 667 pt phone the widest board its canvas allows and 44 pt tray slots', () => {
    const layout = layoutBoard({ ...SMALL_PHONE, view: LARGEST_VIEW, isMirrored: false });
    const [board, tray] = layout.regions;
    expect([board?.cell, (tray?.cell ?? 0) >= MIN_TOUCH_PT]).toStrictEqual([42, true]);
    expect(edgeCells().filter((cell) => !isReachableByDrag(layout, cell))).toStrictEqual([]);
  });

  it('keeps every edge row reachable by a lifted drag in portrait (the tray lies below)', () => {
    const layout = layoutBoard({ ...PHONE_BOARD, view: LARGEST_VIEW, isMirrored: false });
    expect(edgeCells().filter((cell) => !isReachableByDrag(layout, cell))).toStrictEqual([]);
  });

  it.each(WIDE_BOARDS)(
    'keeps every edge row reachable by a lifted drag on a wide $width × $height canvas',
    (size) => {
      const layout = layoutBoard({ ...size, view: LARGEST_VIEW, isMirrored: false });
      expect(layout.regions[1]?.cols).toBe(1);
      expect(edgeCells().filter((cell) => !isReachableByDrag(layout, cell))).toStrictEqual([]);
    },
  );
});
