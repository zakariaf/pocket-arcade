// apps/snare-snake/src/board/draw-board.ts
'worklet';

import { cellRect } from '@e07/game-kit/geom/board-layout.ts';
import { fxEntry } from '@e07/game-kit/timeline/sample.ts';
import { drawFittedText } from '@e07/shell/game-host/draw-centered-text.ts';

import { inset, rectAt } from './board-geometry.ts';
import { TURN_ENTITY } from './board-ids.ts';
import { drawBursts, drawCaughtCritters, drawCritters } from './draw-critters.ts';
import { drawFadingSegments, drawLoopFlash, drawSnake } from './draw-snake.ts';
import { BADGE_STRIP_PT } from './layout-board.ts';

import type { BoardToken } from './board-palettes.ts';
import type { SnareSnakeView } from './to-view.ts';
import type { Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { DrawFrame } from '@e07/shell/game-host/board-types.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

type Frame = DrawFrame<SnareSnakeView, BoardToken>;

const CELL_INSET = 0.04;
const CELL_CORNER = 0.18;
const BADGE_WIDTH = 64;
const BADGE_HEIGHT = 28;

/** The board's cells: one soft rounded tile each. */
function drawCells(canvas: SkCanvas, frame: Frame): void {
  const { view, layout, kit, colors } = frame;
  kit.fill.setColor(colors.color.cell);
  for (let cell = 0; cell < view.cols * view.rows; cell += 1) {
    const rect = rectAt(layout, view.cols, cell);
    if (rect === null) continue;
    const corner = rect.width * CELL_CORNER;
    canvas.drawRRect({ rect: inset(rect, CELL_INSET), rx: corner, ry: corner }, kit.fill);
  }
}

/** The host's hinted cells (a hint shows the next step): a ring each. */
function drawHinted(canvas: SkCanvas, frame: Frame): void {
  const { layout, kit, colors, highlight } = frame;
  kit.stroke.setColor(colors.color.hint);
  for (const target of highlight.hinted) {
    const rect = cellRect(layout, target);
    if (rect === null) continue;
    kit.stroke.setStrokeWidth(Math.max(2, rect.width * 0.08));
    const corner = rect.width * CELL_CORNER;
    canvas.drawRRect({ rect: inset(rect, CELL_INSET), rx: corner, ry: corner }, kit.stroke);
  }
}

/** The moves badge sits at the top end of the strip above the grid. */
function badgeRect(frame: Frame): Rect {
  const board = frame.layout.regions[0];
  const end = board === undefined ? frame.layout.width : board.x + board.cols * board.cell;
  return {
    x: end - BADGE_WIDTH,
    y: (BADGE_STRIP_PT - BADGE_HEIGHT) / 2,
    width: BADGE_WIDTH,
    height: BADGE_HEIGHT,
  };
}

/** The moves left in a pill, in the chosen digits; it pops while moves or the bonus are added. */
function drawBadge(canvas: SkCanvas, frame: Frame): void {
  const { kit, colors, view } = frame;
  const rect = badgeRect(frame);
  const pop = fxEntry(frame.fx, 'bonus', TURN_ENTITY);
  canvas.save();
  // The pop overshoots (out-back), so its progress passes 1 mid-track: it plays once started, and
  // its last value is a scale of 1.
  if (pop !== undefined && pop.ageMs > 0) {
    const scale = pop.values[0] ?? 1;
    canvas.translate(rect.x + rect.width / 2, rect.y + rect.height / 2);
    canvas.scale(scale, scale);
    canvas.translate(-(rect.x + rect.width / 2), -(rect.y + rect.height / 2));
  }
  const pill = { rect, rx: rect.height / 2, ry: rect.height / 2 };
  kit.fill.setColor(colors.color.badge);
  canvas.drawRRect(pill, kit.fill);
  kit.stroke.setColor(colors.color.edge);
  kit.stroke.setStrokeWidth(2);
  canvas.drawRRect(pill, kit.stroke);
  if (kit.numberFont !== null) {
    kit.fill.setColor(colors.color.label);
    const label = { text: view.movesLeftText, rect, maxShare: 0.7 };
    drawFittedText(canvas, label, { font: kit.numberFont, paint: kit.fill });
  }
  canvas.restore();
}

/** Paints one frame: cells, what fades, the snake, the critters, the effects, the badge. */
export function drawBoard(canvas: SkCanvas, frame: Frame): void {
  canvas.drawColor(frame.colors.color.background);
  drawCells(canvas, frame);
  drawFadingSegments(canvas, frame);
  drawSnake(canvas, frame);
  drawLoopFlash(canvas, frame);
  drawCritters(canvas, frame);
  drawCaughtCritters(canvas, frame);
  drawBursts(canvas, frame);
  drawHinted(canvas, frame);
  drawBadge(canvas, frame);
}
