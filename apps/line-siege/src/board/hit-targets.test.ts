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
