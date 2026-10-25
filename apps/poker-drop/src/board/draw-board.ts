// apps/poker-drop/src/board/draw-board.ts
'worklet';

import { playingEntry } from '@e07/game-kit/timeline/sample.ts';
import { setPaintColor } from '@e07/shell/game-host/board-kit.ts';

import { TURN_ENTITY } from './board-ids.ts';
import { drawGoneCards, drawWellCards } from './draw-cards.ts';
import { drawBursts } from './draw-effects.ts';
import { cardFace, slotAt, valueAt } from './draw-parts.ts';
import { drawStrip } from './draw-strip.ts';
import { wellFrame, wellRegion } from './layout-board.ts';

import type { Frame } from './draw-parts.ts';
import type { Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { ClipOp, SkCanvas } from '@shopify/react-native-skia';

/** Skia's ClipOp.Intersect (draw imports Skia types only, so the value is spelled out). */
const INTERSECT: ClipOp = 1;
/** An empty cell's mark is a card's outline at this share of a card. */
const SLOT_SHARE = 0.9;

/** The sunken well with its ink edge; the edge turns the warning colour while the well overflows. */
function drawWell(canvas: SkCanvas, frame: Frame, rect: Rect): void {
  const { kit, colors } = frame;
  const corner = rect.width * 0.04;
  kit.fill.setColor(colors.color.well);
  canvas.drawRRect({ rect, rx: corner, ry: corner }, kit.fill);
  kit.stroke.setColor(colors.color.edge);
  kit.stroke.setStrokeWidth(3);
  canvas.drawRRect({ rect, rx: corner, ry: corner }, kit.stroke);
  const overflow = playingEntry(frame.fx, 'overflow', TURN_ENTITY);
  if (overflow === undefined) return;
  setPaintColor(kit.stroke, colors.color.warn, valueAt(overflow, 0));
  kit.stroke.setStrokeWidth(8);
  canvas.drawRRect({ rect, rx: corner, ry: corner }, kit.stroke);
  kit.stroke.setAlphaf(1);
}

/** The 30 cells as faint card outlines, so the columns read as places for cards. */
function drawSlots(canvas: SkCanvas, frame: Frame): void {
  const { view, kit, colors } = frame;
  kit.fill.setColor(colors.color.slot);
  for (let row = 0; row < view.rows; row += 1) {
    for (let col = 0; col < view.cols; col += 1) {
      const rect = slotAt(frame, col, row);
      const mark = cardFace(rect, SLOT_SHARE);
      canvas.drawRRect({ rect: mark, rx: mark.width * 0.14, ry: mark.width * 0.14 }, kit.fill);
    }
  }
}

/** The host's hinted move: a ring around each hinted well cell (EMPTY_HIGHLIGHT draws nothing). */
function drawHinted(canvas: SkCanvas, frame: Frame): void {
  const { kit, colors, view } = frame;
  for (const target of frame.highlight.hinted) {
    if (target.regionId !== 'well') continue;
    // Hit-test rows count from the top; the well's rows count from the bottom.
    const rect = slotAt(frame, target.col, view.rows - 1 - target.row);
    kit.stroke.setColor(colors.color.hint);
    kit.stroke.setStrokeWidth(Math.max(2, rect.width * 0.08));
    canvas.drawRRect({ rect, rx: rect.width * 0.16, ry: rect.width * 0.16 }, kit.stroke);
  }
}

/**
 * Pure worklet: reads only its arguments, allocates no Skia objects, reads no clock. The cards are
 * clipped at the well's floor, so a rising row comes up out of it; a dropped card starts above.
 */
export function drawBoard(canvas: SkCanvas, frame: Frame): void {
  canvas.drawColor(frame.colors.color.background);
  const well = wellRegion(frame.layout);
  if (well.cell <= 0) return;
  drawWell(canvas, frame, wellFrame(frame.layout));
  drawSlots(canvas, frame);
  drawHinted(canvas, frame);
  drawStrip(canvas, frame);
  canvas.save();
  const floor = well.y + well.rows * well.cell;
  const above = { x: 0, y: 0, width: frame.layout.width, height: floor };
  canvas.clipRect(above, INTERSECT, true);
  drawWellCards(canvas, frame);
  drawGoneCards(canvas, frame);
  canvas.restore();
  drawBursts(canvas, frame);
}
