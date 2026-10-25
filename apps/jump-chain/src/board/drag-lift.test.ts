// apps/jump-chain/src/board/drag-lift.test.ts
// The drag lift is applied once, in the gesture layer: the pointer the ghost is drawn from and the
// drop square the move is made from are the same lifted point, so the ghost square is the square
// where the chain ends.
import { cellRect, hitTest } from '@e07/game-kit/geom/board-layout.ts';
import { sampleTimeline } from '@e07/game-kit/timeline/sample.ts';
import { create } from '@e07/jump-chain/rules/create.ts';
import { intentToMove } from '@e07/jump-chain/rules/intent-to-move.ts';
import { EMPTY_HIGHLIGHT, IDLE_POINTER } from '@e07/shell/game-host/board-types.ts';
import { HIT_SLOP, liftedPoint, panIntent } from '@e07/shell/game-host/pan-intent.ts';

import { drawBoard } from './draw-board.ts';
import { jumpChainBoard } from './jump-chain-board.ts';
import { DRAG_LIFT_PT, layoutBoard } from './layout-board.ts';
import { toView } from './to-view.ts';

import type { BoardToken } from './board-palettes.ts';
import type { Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { JumpChainState, Square } from '@e07/jump-chain/rules/jump-chain-types.ts';
import type { BoardColors, PointerSample, RenderKit } from '@e07/shell/game-host/board-types.ts';
import type { SkCanvas, SkColor, SkPaint } from '@shopify/react-native-skia';

/** Five enemies around (2, 6): chains end on (0, 4), (2, 2), (4, 4), (6, 2) and back on (2, 6). */
const STATE: JumpChainState = {
  ...create(1, 0),
  piece: { col: 2, row: 6 },
  enemies: [
    [1, 5],
    [3, 5],
    [1, 3],
    [3, 3],
    [5, 3],
  ].map(([col = 0, row = 0], id) => ({ id, rank: 0, col, row })),
  total: 5,
  nextId: 5,
};
const VIEW = toView(STATE, { formatNumber: String });
const LAYOUT = layoutBoard({ width: 374, height: 660, view: VIEW, isMirrored: false });
const PIECE = { regionId: 'board', ...STATE.piece };
const PAINT = new Proxy({}, { get: () => () => undefined }) as SkPaint;
const KIT: RenderKit = { fill: PAINT, stroke: PAINT, numberFont: null, paths: {}, labels: {} };
const COLOR = new Float32Array([0, 0, 0, 1]) as SkColor;
const COLORS = {
  scheme: 'light',
  isColorBlind: false,
  color: new Proxy({}, { get: () => COLOR }),
} as unknown as BoardColors<BoardToken>;

/** The pointer the gesture layer writes while a finger at `finger` drags the piece. */
function pointerAt(finger: { readonly x: number; readonly y: number }): PointerSample {
  const aim = liftedPoint(finger, DRAG_LIFT_PT);
  const hover = hitTest(LAYOUT, aim, HIT_SLOP);
  return { isDown: true, x: aim.x, y: aim.y, hover, dragFrom: PIECE };
}

/** Centres of the circles drawBoard draws for a pointer. */
function circles(pointer: PointerSample): string[] {
  const centres: string[] = [];
  const canvas = new Proxy(
    {},
    {
      get:
        (_target, name) =>
        (...args: unknown[]) => {
          if (name === 'drawCircle') centres.push(`${String(args[0])},${String(args[1])}`);
        },
    },
  ) as SkCanvas;
  const fx = { ...sampleTimeline([], 0), pointer };
  drawBoard(canvas, {
    view: VIEW,
    fx,
    highlight: EMPTY_HIGHLIGHT,
    colors: COLORS,
    layout: LAYOUT,
    kit: KIT,
  });
  return centres;
}

/** The circles this pointer adds to idle drawing (the ghost and the capture rings), by centre. */
function ghostCentres(pointer: PointerSample): string[] {
  const idle = circles(IDLE_POINTER);
  return circles(pointer).filter((centre) => {
    const at = idle.indexOf(centre);
    if (at < 0) return true;
    idle.splice(at, 1);
    return false;
  });
}

function rectOf(square: Square): Rect {
  const rect = cellRect(LAYOUT, { regionId: 'board', ...square });
  if (rect === null) throw new Error('no square');
  return rect;
}

function centreKey(rect: Rect): string {
  return `${String(rect.x + rect.width / 2)},${String(rect.y + rect.height / 2)}`;
}

describe('the drag lift', () => {
  it('is the lift the board declares to the gesture layer', () => {
    expect(jumpChainBoard.dragLiftPt).toBe(DRAG_LIFT_PT);
  });

  it('plays the chain that ends exactly on the square its ghost is drawn on', () => {
    const target = rectOf({ col: 2, row: 2 });
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
    expect(move).toStrictEqual({
      kind: 'jump',
      path: [
        { col: 0, row: 4 },
        { col: 2, row: 2 },
      ],
    });
    expect(ghostCentres(pointer)).toContain(centreKey(target));
  });

  it('draws no ghost where the finger itself is, only one lift above it', () => {
    const below = rectOf({ col: 2, row: 3 });
    const finger = { x: below.x + below.width / 2, y: below.y + below.height / 2 };
    const ghosts = ghostCentres(pointerAt(finger));
    expect(ghosts).toContain(centreKey(rectOf({ col: 2, row: 2 })));
    expect(ghosts).not.toContain(centreKey(below));
  });
});
