// apps/trail-clear/src/board/hit-targets.test.ts
// Spec S5 and 8.11: every touch target is at least 44 x 44 pt, and every cell can be reached by a
// lifted drag (the ghost rides DRAG_LIFT_PT above the finger).
import { cellRect, hitTest } from '@e07/game-kit/geom/board-layout.ts';
import { HIT_SLOP, liftedPoint } from '@e07/shell/game-host/pan-intent.ts';
import { create } from '@e07/trail-clear/rules/create.ts';
import { TRAIL_CLEAR_TEACHING } from '@e07/trail-clear/tutorial/trail-clear-teaching.ts';

import { DRAG_LIFT_PT, layoutBoard, traySlotRect } from './layout-board.ts';
import { trailClearBoard } from './trail-clear-board.ts';

import type { TrailClearView } from './to-view.ts';
import type { BoardLayout, BoardTarget } from '@e07/game-kit/geom/board-layout.ts';

/** Touch targets on boards are at least 44 pt (an exception needs the owner's sign-off). */
const MIN_TOUCH_PT = 44;
/** Board area on a 402 × 874 pt phone: 374 pt wide (14 pt side margins), 660 pt tall. */
const PHONE_BOARD = { width: 374, height: 660 };
/**
 * The board canvas S5 leaves: the screen minus the status bar, the game top bar (60 pt) and the
 * board margins 4 / 14 / 40 (top / sides / bottom).
 */
const PHONES = [
  { phone: '390 × 844', width: 390 - 28, height: 844 - 54 - 60 - 44 },
  { phone: '402 × 874', width: 402 - 28, height: 874 - 62 - 60 - 44 },
  { phone: '375 × 667', width: 375 - 28, height: 667 - 20 - 60 - 44 },
];
/** Wide canvases: the tray stands beside the board (a phone on its side, an iPad in landscape). */
const WIDE_BOARDS = [
  { width: 820, height: 420 },
  { width: 1024, height: 700 },
];
/** Trail Clear's only grid: 5 × 5, with the widest tray (four turns of the offered tile). */
const LARGEST_VIEW: TrailClearView = {
  size: 5,
  cells: Array.from({ length: 25 }, () => []),
  tray: [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ],
  wipes: [],
  pointsText: [],
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
  return [0, 4].flatMap((row) =>
    Array.from({ length: 5 }, (_, col) => ({ regionId: 'board', col, row })),
  );
}

describe('trail clear hit targets', () => {
  it('keeps board cells and tray slots at least 44 pt on a 402 × 874 pt phone', () => {
    const layout = layoutBoard({ ...PHONE_BOARD, view: LARGEST_VIEW, isMirrored: false });
    expect(layout.regions.map((region) => [region.id, region.cell >= MIN_TOUCH_PT])).toStrictEqual([
      ['board', true],
      ['tray', true],
    ]);
  });

  it.each(PHONES)(
    'keeps 44 pt targets and every edge row reachable on the S5 canvas of a $phone pt phone',
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

  it.each(WIDE_BOARDS)(
    'keeps every edge row reachable by a lifted drag on a wide $width × $height canvas',
    (size) => {
      const layout = layoutBoard({ ...size, view: LARGEST_VIEW, isMirrored: false });
      expect(layout.regions[1]?.cols).toBe(1);
      expect(edgeCells().filter((cell) => !isReachableByDrag(layout, cell))).toStrictEqual([]);
    },
  );
});

/** The slot a target on the tray names, whichever way the tray lies (null off the tray). */
function slotOfTarget(target: BoardTarget | null): number | null {
  return target?.regionId === 'tray' ? target.col + target.row : null;
}

/** Where the Shell draws a target: the board's targetRect, else the grid cell (board-host-kit). */
function drawnRect(layout: BoardLayout, target: BoardTarget) {
  return (trailClearBoard.targetRect ?? cellRect)(layout, target);
}

/** The tray targets the hint, the coach and the tutorial hand point at, by the slot each names. */
function pointedTrayTargets(): BoardTarget[] {
  const start = create(1, 0);
  const hinted = [{ kind: 'place-tile', turns: 1, col: 3, row: 2 } as const].flatMap(
    (move) => trailClearBoard.targetsOfMove?.(start, move) ?? [],
  );
  const { tutorial, howToPlay } = TRAIL_CLEAR_TEACHING;
  const pointers = [...tutorial.steps, ...howToPlay].map((step) => step.pointer);
  const fromHand = pointers.flatMap((pointer) => (pointer.kind === 'drag' ? [pointer.from] : []));
  return [...hinted, ...fromHand].filter((target) => target.regionId === 'tray');
}

describe('trail clear tray targets (hint, coach and tutorial hand)', () => {
  it.each([PHONE_BOARD, ...WIDE_BOARDS])(
    'draws every pointed tray target on the slot it names, where hit-testing finds that slot, on a $width × $height canvas',
    (size) => {
      const layout = layoutBoard({ ...size, view: LARGEST_VIEW, isMirrored: false });
      const targets = pointedTrayTargets();
      expect(targets.length).toBeGreaterThan(0);
      const misplaced = targets.filter((target) => {
        const slot = slotOfTarget(target) ?? -1;
        const rect = drawnRect(layout, target);
        if (rect === null) return true;
        const centre = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        const hit = hitTest(layout, centre, HIT_SLOP);
        return (
          slotOfTarget(hit) !== slot ||
          JSON.stringify(rect) !== JSON.stringify(traySlotRect(layout, slot))
        );
      });
      expect(misplaced).toStrictEqual([]);
    },
  );
});
