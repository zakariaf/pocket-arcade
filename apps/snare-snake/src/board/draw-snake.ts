// apps/snare-snake/src/board/draw-snake.ts
'worklet';

import { fxEntry } from '@e07/game-kit/timeline/sample.ts';

import { inset, isPlaying, rectAt, rectBetween } from './board-geometry.ts';
import { cellEntity, HEAD_ENTITY, TURN_ENTITY } from './board-ids.ts';

import type { BoardToken } from './board-palettes.ts';
import type { SnareSnakeView } from './to-view.ts';
import type { Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { DrawFrame } from '@e07/shell/game-host/board-types.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

type Frame = DrawFrame<SnareSnakeView, BoardToken>;

/** A segment fills this share less of its cell on every side; the head a little less. */
const SEGMENT_INSET = 0.14;
const HEAD_INSET = 0.08;
const CORNER = 0.24;
/** Width of a body connector between two segments, as a share of the cell. */
const BRIDGE = 0.44;
/** Width of the ink edge, as a share of the cell. */
const EDGE = 0.05;

/** A segment to draw; alpha below 1 while it fades (set after the colour, which resets it). */
type Segment = { readonly rect: Rect; readonly token: BoardToken; readonly alpha?: number };

/** One rounded segment: the fill, then its ink edge (Toybox fills carry an ink edge). */
function drawSegment(canvas: SkCanvas, frame: Frame, segment: Segment): void {
  const { kit, colors } = frame;
  const { rect, token } = segment;
  const corner = rect.width * CORNER;
  kit.fill.setColor(colors.color[token]);
  kit.fill.setAlphaf(segment.alpha ?? 1);
  canvas.drawRRect({ rect, rx: corner, ry: corner }, kit.fill);
  kit.stroke.setColor(colors.color.edge);
  kit.stroke.setAlphaf(segment.alpha ?? 1);
  kit.stroke.setStrokeWidth(Math.max(1, rect.width * EDGE));
  canvas.drawRRect({ rect, rx: corner, ry: corner }, kit.stroke);
}

/** The bar that joins two neighbouring segments' centres. */
function drawBridge(canvas: SkCanvas, frame: Frame, pair: readonly [Rect, Rect]): void {
  const [a, b] = pair;
  const half = (a.width * BRIDGE) / 2;
  const ax = a.x + a.width / 2;
  const ay = a.y + a.height / 2;
  const bx = b.x + b.width / 2;
  const by = b.y + b.height / 2;
  frame.kit.fill.setColor(frame.colors.color.snake);
  canvas.drawRect(
    {
      x: Math.min(ax, bx) - half,
      y: Math.min(ay, by) - half,
      width: Math.abs(ax - bx) + 2 * half,
      height: Math.abs(ay - by) + 2 * half,
    },
    frame.kit.fill,
  );
}

/** Where the head is drawn: sliding from its old cell while its track plays, else its cell. */
function headRect(frame: Frame): Rect | null {
  const { view, layout } = frame;
  const slide = fxEntry(frame.fx, 'head', HEAD_ENTITY);
  if (slide !== undefined) return rectBetween(layout, view.cols, slide.values);
  return rectAt(layout, view.cols, view.snake[0] ?? 0);
}

/** Two eyes looking the way the head moves: a white eye and its dark pupil each. */
function drawEyes(canvas: SkCanvas, frame: Frame, head: Rect): void {
  const { kit, colors, view } = frame;
  const cx = head.x + head.width / 2;
  const cy = head.y + head.height / 2;
  const isAcross = view.heading === 'left' || view.heading === 'right';
  const ahead = view.heading === 'right' || view.heading === 'down' ? 1 : -1;
  const look = head.width * 0.14 * ahead;
  for (const side of [-1, 1]) {
    const x = cx + (isAcross ? look : side * head.width * 0.18);
    const y = cy + (isAcross ? side * head.width * 0.18 : look);
    kit.fill.setColor(colors.color.eye);
    canvas.drawCircle(x, y, head.width * 0.12, kit.fill);
    kit.fill.setColor(colors.color.spot);
    canvas.drawCircle(x + look * 0.3, y + (isAcross ? 0 : look * 0.3), head.width * 0.06, kit.fill);
  }
}

/** The body tail first, then the head on top with its eyes. */
export function drawSnake(canvas: SkCanvas, frame: Frame): void {
  const { view, layout } = frame;
  const rects = view.snake.map((cell) => rectAt(layout, view.cols, cell));
  const head = headRect(frame);
  for (let i = rects.length - 1; i >= 1; i -= 1) {
    const rect = rects[i];
    const next = i === 1 ? head : rects[i - 1];
    if (rect === null || rect === undefined) continue;
    if (next !== null && next !== undefined) drawBridge(canvas, frame, [rect, next]);
    drawSegment(canvas, frame, { rect: inset(rect, SEGMENT_INSET), token: 'snake' });
  }
  if (head === null) return;
  drawSegment(canvas, frame, { rect: inset(head, HEAD_INSET), token: 'head' });
  drawEyes(canvas, frame, inset(head, HEAD_INSET));
}

/**
 * Segments that are gone in the final view but still fading: the cell the tail left, the loop's
 * spent segments. At moment 0 they still show (a tween of something visible).
 */
export function drawFadingSegments(canvas: SkCanvas, frame: Frame): void {
  const { view, layout, kit, fx } = frame;
  for (let cell = 0; cell < view.cols * view.rows; cell += 1) {
    const fading = fxEntry(fx, 'spent', cellEntity(cell)) ?? fxEntry(fx, 'tail', cellEntity(cell));
    const alpha = fading?.values[0] ?? 0;
    const rect = alpha > 0 ? rectAt(layout, view.cols, cell) : null;
    if (rect === null) continue;
    drawSegment(canvas, frame, { rect: inset(rect, SEGMENT_INSET), token: 'snake', alpha });
  }
  kit.fill.setAlphaf(1);
  kit.stroke.setAlphaf(1);
}

/** One glowing ring around a cell of the closed loop. */
function drawGlow(canvas: SkCanvas, frame: Frame, rect: Rect): void {
  const corner = rect.width * CORNER;
  canvas.drawRRect({ rect: inset(rect, 0.02), rx: corner, ry: corner }, frame.kit.stroke);
}

/**
 * The closed loop lights up while its flash plays: a glow ring around every cell it spent and
 * around the head that closed it, over the snake. An effect: nothing at moment 0.
 */
export function drawLoopFlash(canvas: SkCanvas, frame: Frame): void {
  const { view, layout, kit, colors, fx } = frame;
  const flash = fxEntry(fx, 'loop', TURN_ENTITY);
  if (!isPlaying(flash)) return;
  kit.stroke.setColor(colors.color.glow);
  kit.stroke.setAlphaf(flash.values[0] ?? 0);
  for (let cell = 0; cell < view.cols * view.rows; cell += 1) {
    const isLoop = fxEntry(fx, 'spent', cellEntity(cell)) !== undefined || cell === view.snake[0];
    const rect = isLoop ? rectAt(layout, view.cols, cell) : null;
    if (rect === null) continue;
    kit.stroke.setStrokeWidth(Math.max(2, rect.width * 0.08));
    drawGlow(canvas, frame, rect);
  }
  kit.stroke.setAlphaf(1);
}
