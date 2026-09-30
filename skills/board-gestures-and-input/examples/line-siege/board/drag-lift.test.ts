// apps/line-siege/src/board/drag-lift.test.ts
// The drag lift is applied once, in the gesture layer: the pointer the ghost is drawn from and the
// drop target the move is made from are the same lifted point, so the ghost cell is the placed cell.
import { cellRect, hitTest } from '@e07/game-kit/geom/board-layout.ts';
import { sampleTimeline } from '@e07/game-kit/timeline/sample.ts';
import { create } from '@e07/line-siege/rules/create.ts';
import { intentToMove } from '@e07/line-siege/rules/intent-to-move.ts';
import { EMPTY_HIGHLIGHT, IDLE_POINTER } from '@e07/shell/game-host/board-types.ts';
import { HIT_SLOP, liftedPoint, panIntent } from '@e07/shell/game-host/pan-intent.ts';

import { drawBoard } from './draw-board.ts';
import { DRAG_LIFT_PT, layoutBoard } from './layout-board.ts';
import { lineSiegeBoard } from './line-siege-board.ts';
import { toView } from './to-view.ts';

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

/** The rounded rects drawBoard draws for this pointer and not for an idle one: the ghost blocks. */
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
    expect(lineSiegeBoard.dragLiftPt).toBe(DRAG_LIFT_PT);
  });

  it('places the block exactly on the cell its ghost is drawn on', () => {
    // The vertical two of slot 1 fits in column 7 at rows 3-4 on this opening.
    const target = cellRect(LAYOUT, { regionId: 'board', col: 7, row: 3 });
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
    expect(move).toStrictEqual({ kind: 'place-block', trayIndex: 1, col: 7, row: 3 });
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
    const cell = cellRect(LAYOUT, { regionId: 'board', col: 3, row: 5 });
    if (cell === null) throw new Error('no cell');
    const finger = { x: cell.x + cell.width / 2, y: cell.y + cell.height / 2 };
    const [ghost] = ghostRects(pointerAt(finger));
    expect(ghost !== undefined && ghost.y < cell.y).toBe(true);
  });
});
