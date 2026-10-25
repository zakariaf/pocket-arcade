// apps/trail-clear/src/board/drag-lift.test.ts
// The drag lift is applied once, in the gesture layer: the pointer the ghost is drawn from and the
// drop target the move is made from are the same lifted point, so the ghost cell is the placed cell.
import { cellRect, hitTest } from '@e07/game-kit/geom/board-layout.ts';
import { sampleTimeline } from '@e07/game-kit/timeline/sample.ts';
import { EMPTY_HIGHLIGHT, IDLE_POINTER } from '@e07/shell/game-host/board-types.ts';
import { HIT_SLOP, liftedPoint, panIntent } from '@e07/shell/game-host/pan-intent.ts';
import { create } from '@e07/trail-clear/rules/create.ts';
import { intentToMove } from '@e07/trail-clear/rules/intent-to-move.ts';

import { drawBoard } from './draw-board.ts';
import { DRAG_LIFT_PT, layoutBoard, traySlotRect } from './layout-board.ts';
import { toView } from './to-view.ts';
import { trailClearBoard } from './trail-clear-board.ts';

import type { BoardToken } from './board-palettes.ts';
import type { Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { BoardColors, PointerSample, RenderKit } from '@e07/shell/game-host/board-types.ts';
import type { SkCanvas, SkColor, SkPaint } from '@shopify/react-native-skia';

const STATE = create(1, 0);
const VIEW = toView(STATE, { formatNumber: String });
const LAYOUT = layoutBoard({ width: 374, height: 660, view: VIEW, isMirrored: false });
const SLOT = { regionId: 'tray', col: 1, row: 0 };
const PAINT = new Proxy({}, { get: () => () => undefined }) as SkPaint;
const KIT: RenderKit = { fill: PAINT, stroke: PAINT, numberFont: null, paths: {}, labels: {} };
const COLOR = new Float32Array([0, 0, 0, 1]) as SkColor;
const COLORS = {
  scheme: 'light',
  isColorBlind: false,
  color: new Proxy({}, { get: () => COLOR }),
} as unknown as BoardColors<BoardToken>;

/** The pointer the gesture layer writes while a finger at `finger` drags tray slot 1. */
function pointerAt(finger: { readonly x: number; readonly y: number }): PointerSample {
  const aim = liftedPoint(finger, DRAG_LIFT_PT);
  const hover = hitTest(LAYOUT, aim, HIT_SLOP);
  return { isDown: true, x: aim.x, y: aim.y, hover, dragFrom: SLOT };
}

/** The rounded rects drawBoard draws for this pointer and not for an idle one: the ghost tile. */
function ghostRects(pointer: PointerSample): Rect[] {
  const draw = (fingerPointer: PointerSample): Rect[] => {
    const rects: Rect[] = [];
    const canvas = new Proxy(
      {},
      {
        get:
          (_target, name) =>
          (...args: unknown[]) => {
            const rrect = args[0] as { rect?: Rect } | undefined;
            if (name === 'drawRRect' && rrect?.rect !== undefined) rects.push(rrect.rect);
          },
      },
    ) as SkCanvas;
    const fx = { ...sampleTimeline([], 0), pointer: fingerPointer };
    drawBoard(canvas, {
      view: VIEW,
      fx,
      highlight: EMPTY_HIGHLIGHT,
      colors: COLORS,
      layout: LAYOUT,
      kit: KIT,
    });
    return rects;
  };
  return draw(pointer).slice(draw(IDLE_POINTER).length);
}

describe('the drag lift', () => {
  it('is the lift the board declares to the gesture layer', () => {
    expect(trailClearBoard.dragLiftPt).toBe(DRAG_LIFT_PT);
  });

  it('places the tile exactly on the cell its ghost is drawn on', () => {
    // Seed 1: the ford of slot 1 (one quarter turn) closes the opening's double at (3, 2).
    const target = cellRect(LAYOUT, { regionId: 'board', col: 3, row: 2 });
    if (target === null) throw new Error('no cell');
    const finger = {
      x: target.x + target.width / 2,
      y: target.y + target.height / 2 + DRAG_LIFT_PT,
    };
    const pointer = pointerAt(finger);
    const release = { ...finger, translationX: 0, translationY: -200, velocityX: 0, velocityY: 0 };
    const intent = panIntent({
      mode: 'drag',
      pointer,
      release,
      layout: LAYOUT,
      dragLiftPt: DRAG_LIFT_PT,
    });
    const move = intent === null ? null : intentToMove(STATE, intent);
    expect(move).toStrictEqual({ kind: 'place-tile', turns: 1, col: 3, row: 2 });
    const [anchorGhost] = ghostRects(pointer);
    expect(
      anchorGhost !== undefined &&
        anchorGhost.x > target.x &&
        anchorGhost.x < target.x + target.width,
    ).toBe(true);
    expect(
      anchorGhost !== undefined &&
        anchorGhost.y > target.y &&
        anchorGhost.y < target.y + target.height,
    ).toBe(true);
  });

  it('draws no ghost where the finger itself is, only one lift above it', () => {
    const cell = cellRect(LAYOUT, { regionId: 'board', col: 3, row: 4 });
    if (cell === null) throw new Error('no cell');
    const finger = { x: cell.x + cell.width / 2, y: cell.y + cell.height / 2 };
    const [ghost] = ghostRects(pointerAt(finger));
    expect(ghost !== undefined && ghost.y < cell.y).toBe(true);
  });
});

/**
 * S5 board canvases: a tall phone, the shortest phone (375 × 667 pt), and a short canvas whose
 * tray is one slot high, so a lift from the slot's top part reaches the board's last row.
 */
const CANVASES = [
  { phone: 'a 402 × 874 pt phone', width: 374, height: 660 },
  { phone: 'a 375 × 667 pt phone', width: 375 - 28, height: 667 - 20 - 60 - 44 },
  { phone: 'a short 347 × 420 pt canvas', width: 347, height: 420 },
];

describe('a drag put back on the tray', () => {
  it.each(CANVASES)(
    'cancels a release anywhere on the slot it started from, its top part too, on $phone',
    (canvas) => {
      const layout = layoutBoard({ ...canvas, view: VIEW, isMirrored: false });
      const placed = [0, 1, 2, 3].flatMap((slot) => {
        const rect = traySlotRect(layout, slot);
        if (rect === null) return [`slot ${String(slot)}: no rect`];
        const from = hitTest(layout, { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
        const pointer: PointerSample = { ...IDLE_POINTER, isDown: true, dragFrom: from };
        // The slot's top edge, its top part (within one lift of it), its middle and its bottom.
        const heights = [1, DRAG_LIFT_PT / 2, rect.height / 2, rect.height - 1];
        return heights.flatMap((dy) => {
          const finger = { x: rect.x + rect.width / 2, y: rect.y + dy };
          const release = {
            ...finger,
            translationX: 0,
            translationY: 0,
            velocityX: 0,
            velocityY: 0,
          };
          const intent = panIntent({
            mode: 'drag',
            pointer,
            release,
            layout,
            dragLiftPt: DRAG_LIFT_PT,
          });
          const move = intent === null ? null : intentToMove(STATE, intent);
          return move === null
            ? []
            : [`slot ${String(slot)} at +${String(dy)} pt placed ${JSON.stringify(move)}`];
        });
      });
      expect(placed).toStrictEqual([]);
    },
  );
});
