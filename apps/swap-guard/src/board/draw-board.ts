// apps/swap-guard/src/board/draw-board.ts
'worklet';

import { cellRect } from '@e07/game-kit/geom/board-layout.ts';
import { fxEntry } from '@e07/game-kit/timeline/sample.ts';
import { setPaintColor } from '@e07/shell/game-host/board-kit.ts';
import { drawFittedText } from '@e07/shell/game-host/draw-centered-text.ts';

import { degreesOf, drawUnitPath, inset, isPlaying, rectAt, scaled } from './board-geometry.ts';
import { cellEntity, TURN_ENTITY } from './board-ids.ts';
import { drawBursts, drawEnemies, drawFallen, drawGuard, drawGuardHit } from './draw-pieces.ts';
import { BADGE_STRIP_PT } from './layout-board.ts';

import type { BoardToken } from './board-palettes.ts';
import type { SwapGuardView } from './to-view.ts';
import type { Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { DrawFrame } from '@e07/shell/game-host/board-types.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

type Frame = DrawFrame<SwapGuardView, BoardToken>;

const CELL_INSET = 0.04;
const CELL_CORNER = 0.18;
const MARK_SIZE = 0.3;
const BADGE_WIDTH = 64;
const BADGE_HEIGHT = 28;
const PIP_RADIUS = 4.5;
const PIP_STEP = 12;

/** One square's tile shape (cells, shading, flashes and hint rings share it). */
function tileOf(rect: Rect): { rect: Rect; rx: number; ry: number } {
  const corner = rect.width * CELL_CORNER;
  return { rect: inset(rect, CELL_INSET), rx: corner, ry: corner };
}

/** The board's squares: one soft rounded tile each. */
function drawCells(canvas: SkCanvas, frame: Frame): void {
  const { view, layout, kit, colors } = frame;
  setPaintColor(kit.fill, colors.color.cell, 1);
  for (let cell = 0; cell < view.size * view.size; cell += 1) {
    const rect = rectAt(layout, view.size, cell);
    if (rect !== null) canvas.drawRRect(tileOf(rect), kit.fill);
  }
}

/** A square to shade and how strongly (1 = solid). */
type Shade = { readonly rect: Rect; readonly alpha: number };

/** A shaded square with its ink edge, at `alpha` (a fade in or out). */
function drawShade(canvas: SkCanvas, frame: Frame, shade: Shade): void {
  const { kit, colors } = frame;
  const { rect, alpha } = shade;
  setPaintColor(kit.fill, colors.color.threat, alpha);
  canvas.drawRRect(tileOf(rect), kit.fill);
  setPaintColor(kit.stroke, colors.color.edge, alpha);
  kit.stroke.setStrokeWidth(Math.max(1, rect.width * 0.03));
  canvas.drawRRect(tileOf(rect), kit.stroke);
}

/**
 * The telegraph: every square the next volley strikes is shaded and carries an arrow the way its
 * strike goes (a shape cue, never colour alone). It fades in once the move's volley has landed.
 */
function drawTelegraph(canvas: SkCanvas, frame: Frame): void {
  const { view, layout, kit, colors } = frame;
  const alpha = fxEntry(frame.fx, 'telegraph', TURN_ENTITY)?.values[0] ?? 1;
  if (alpha <= 0) return;
  let last = -1;
  for (const mark of view.marks) {
    const rect = rectAt(layout, view.size, mark.cell);
    if (rect === null || mark.cell === last) continue;
    last = mark.cell;
    drawShade(canvas, frame, { rect, alpha });
  }
  const arrow = kit.paths['chevron'];
  if (arrow === undefined) return;
  setPaintColor(kit.fill, colors.color.mark, alpha);
  for (const mark of view.marks) {
    const rect = rectAt(layout, view.size, mark.cell);
    if (rect === null) continue;
    const place = scaled(rect, MARK_SIZE);
    drawUnitPath(canvas, {
      path: arrow,
      rect: place,
      degrees: degreesOf(mark.facing),
      paint: kit.fill,
    });
  }
}

/** The squares the move's volley strikes: their old shading fades while a glow grows on them. */
function drawLanding(canvas: SkCanvas, frame: Frame): void {
  const { view, layout, kit, colors, fx } = frame;
  for (let cell = 0; cell < view.size * view.size; cell += 1) {
    const struck = fxEntry(fx, 'struck', cellEntity(cell));
    const rect = struck === undefined ? null : rectAt(layout, view.size, cell);
    if (rect === null) continue;
    const shade = struck?.values[0] ?? 0;
    if (shade > 0) drawShade(canvas, frame, { rect, alpha: shade });
    const flash = fxEntry(fx, 'flash', cellEntity(cell));
    if (!isPlaying(flash)) continue;
    const glow = flash.values[0] ?? 0;
    setPaintColor(kit.fill, colors.color.flash, 1 - glow);
    canvas.drawRRect(tileOf(scaled(rect, 0.7 + glow * 0.35)), kit.fill);
  }
}

/** The host's hinted squares (a paid hint shows the next swap): a ring each. */
function drawHinted(canvas: SkCanvas, frame: Frame): void {
  const { layout, kit, colors, highlight } = frame;
  setPaintColor(kit.stroke, colors.color.hint, 1);
  for (const target of highlight.hinted) {
    const rect = cellRect(layout, target);
    if (rect === null) continue;
    kit.stroke.setStrokeWidth(Math.max(2, rect.width * 0.08));
    canvas.drawRRect(tileOf(rect), kit.stroke);
  }
}

/** The x where the board's grid starts and ends (the strip above lines up with it). */
function gridSpan(frame: Frame): { readonly start: number; readonly end: number } {
  const board = frame.layout.regions[0];
  if (board === undefined) return { start: 0, end: frame.layout.width };
  return { start: board.x, end: board.x + board.cols * board.cell };
}

/** A row of pips, one per swap of the level: filled while left, hollow once made. */
function drawPips(canvas: SkCanvas, frame: Frame): void {
  const { view, kit, colors } = frame;
  const { start, end } = gridSpan(frame);
  const room = end - start - BADGE_WIDTH - PIP_STEP;
  const step = view.maxSwaps > 0 ? Math.min(PIP_STEP, room / view.maxSwaps) : PIP_STEP;
  const radius = Math.min(PIP_RADIUS, step * 0.38);
  const cy = BADGE_STRIP_PT / 2;
  kit.stroke.setStrokeWidth(1.5);
  setPaintColor(kit.stroke, colors.color.edge, 1);
  setPaintColor(kit.fill, colors.color.pip, 1);
  for (let pip = 0; pip < view.maxSwaps; pip += 1) {
    const cx = start + step / 2 + pip * step;
    if (pip < view.swapsLeft) canvas.drawCircle(cx, cy, radius, kit.fill);
    canvas.drawCircle(cx, cy, radius, kit.stroke);
  }
}

/** The swaps left in a pill at the top end of the strip, in the chosen digits. */
function drawBadge(canvas: SkCanvas, frame: Frame): void {
  const { kit, colors, view } = frame;
  const rect = {
    x: gridSpan(frame).end - BADGE_WIDTH,
    y: (BADGE_STRIP_PT - BADGE_HEIGHT) / 2,
    width: BADGE_WIDTH,
    height: BADGE_HEIGHT,
  };
  const pill = { rect, rx: rect.height / 2, ry: rect.height / 2 };
  setPaintColor(kit.fill, colors.color.badge, 1);
  canvas.drawRRect(pill, kit.fill);
  setPaintColor(kit.stroke, colors.color.edge, 1);
  kit.stroke.setStrokeWidth(2);
  canvas.drawRRect(pill, kit.stroke);
  if (kit.numberFont === null) return;
  setPaintColor(kit.fill, colors.color.label, 1);
  const label = { text: view.swapsLeftText, rect, maxShare: 0.7 };
  drawFittedText(canvas, label, { font: kit.numberFont, paint: kit.fill });
}

/** Paints one frame: squares, strikes, the pieces, the effects, the swaps strip. */
export function drawBoard(canvas: SkCanvas, frame: Frame): void {
  canvas.drawColor(frame.colors.color.background);
  drawCells(canvas, frame);
  drawTelegraph(canvas, frame);
  drawLanding(canvas, frame);
  drawHinted(canvas, frame);
  drawFallen(canvas, frame);
  drawEnemies(canvas, frame);
  drawGuard(canvas, frame);
  drawGuardHit(canvas, frame);
  drawBursts(canvas, frame);
  drawPips(canvas, frame);
  drawBadge(canvas, frame);
}
