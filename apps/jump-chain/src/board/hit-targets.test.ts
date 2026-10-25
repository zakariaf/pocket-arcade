// apps/jump-chain/src/board/hit-targets.test.ts
import { cellRect, hitTest } from '@e07/game-kit/geom/board-layout.ts';
import { HIT_SLOP, liftedPoint } from '@e07/shell/game-host/pan-intent.ts';

import { DRAG_LIFT_PT, layoutBoard } from './layout-board.ts';

import type { JumpChainView } from './to-view.ts';
import type { BoardLayout, BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

/** Touch targets on boards are at least 44 pt (an exception needs the owner's sign-off). */
const MIN_TOUCH_PT = 44;
/** Board area on a 402 × 874 pt phone: 374 pt wide (14 pt side margins); 660 pt tall is below the
 * Toybox S5 area (708 pt), leaving room for a taller top bar at large text sizes. */
const PHONE_BOARD = { width: 374, height: 660 };
/**
 * The board canvas S5 leaves on common phones: the screen minus the status bar, the Toybox game top
 * bar (60 pt) and the board margins 4 / 14 / 40 (top / sides / bottom). Status bars: 54 pt on the
 * 390 × 844 design phone, 62 pt on the 402 × 874 parity phone, 59 pt on a 393 × 852 phone and 20 pt
 * on a 375 × 667 phone (home button).
 */
const PHONES = [
  { phone: '390 × 844', width: 390 - 28, height: 844 - 54 - 60 - 44 },
  { phone: '393 × 852', width: 393 - 28, height: 852 - 59 - 60 - 44 },
  { phone: '402 × 874', width: 402 - 28, height: 874 - 62 - 60 - 44 },
  { phone: '375 × 667', width: 375 - 28, height: 667 - 20 - 60 - 44 },
];
/** Wide canvases: a phone on its side and an iPad in landscape. */
const WIDE_BOARDS = [
  { width: 820, height: 420 },
  { width: 1024, height: 700 },
];
/** Jump Chain has one board size: 7 × 10 squares. */
const LARGEST_VIEW: JumpChainView = {
  cols: 7,
  rows: 10,
  piece: { col: 3, row: 7 },
  enemies: [],
  enemiesLeft: 0,
  marchIn: 4,
  marchInText: '4',
  targets: [],
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

/** Every square of the first row and of your side's row. */
function edgeSquares(): BoardTarget[] {
  return [0, LARGEST_VIEW.rows - 1].flatMap((row) =>
    Array.from({ length: LARGEST_VIEW.cols }, (_, col) => ({ regionId: 'board', col, row })),
  );
}

describe('jump chain hit targets', () => {
  it('keeps every square at least 44 pt on a 402 × 874 pt phone', () => {
    const layout = layoutBoard({ ...PHONE_BOARD, view: LARGEST_VIEW, isMirrored: false });
    const smallest = Math.min(...layout.regions.map((region) => region.cell));
    expect(smallest).toBeGreaterThanOrEqual(MIN_TOUCH_PT);
  });

  it.each(PHONES)(
    'keeps squares at least 44 pt and every edge row reachable on a $phone pt phone',
    (size) => {
      const layout = layoutBoard({ ...size, view: LARGEST_VIEW, isMirrored: false });
      expect(layout.regions.every((region) => region.cell >= MIN_TOUCH_PT)).toBe(true);
      expect(edgeSquares().filter((square) => !isReachableByDrag(layout, square))).toStrictEqual(
        [],
      );
    },
  );

  it.each(WIDE_BOARDS)(
    'keeps every edge row reachable by a lifted drag on a wide $width × $height canvas',
    (size) => {
      const layout = layoutBoard({ ...size, view: LARGEST_VIEW, isMirrored: false });
      expect(edgeSquares().filter((square) => !isReachableByDrag(layout, square))).toStrictEqual(
        [],
      );
    },
  );
});
