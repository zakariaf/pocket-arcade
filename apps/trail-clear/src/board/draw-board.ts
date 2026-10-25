// apps/trail-clear/src/board/draw-board.ts
'worklet';

import { cellRect } from '@e07/game-kit/geom/board-layout.ts';
import { sampleParticle } from '@e07/game-kit/timeline/particles.ts';
import { fxEntry, playingEntry } from '@e07/game-kit/timeline/sample.ts';
import { setPaintColor } from '@e07/shell/game-host/board-kit.ts';

import { cellEntity, loopEntity, TURN_ENTITY } from './board-ids.ts';
import { drawFace, inset, INSET, MIN_VISIBLE, scaled } from './draw-parts.ts';
import { drawTile } from './draw-tile.ts';
import { drawChoice, drawGhost, drawHinted, drawTray } from './draw-tray.ts';
import { PANEL_PT } from './layout-board.ts';

import type { Frame } from './draw-parts.ts';
import type { GridRegion, Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

const BURST_COUNT = 18;

function cellOf(frame: Frame, index: number): Rect | null {
  const { size } = frame.view;
  return cellRect(frame.layout, {
    regionId: 'board',
    col: index % size,
    row: Math.floor(index / size),
  });
}

/** The panel under the grid, edged in ink, in the room the layout keeps around it (PANEL_PT). */
function drawPanel(canvas: SkCanvas, frame: Frame, board: GridRegion): void {
  const { kit, colors } = frame;
  const edge = Math.max(2, board.cell * 0.035);
  const margin = PANEL_PT - edge / 2;
  const side = board.cell * board.cols;
  const rect = {
    x: board.x - margin,
    y: board.y - margin,
    width: side + 2 * margin,
    height: side + 2 * margin,
  };
  const corner = board.cell * 0.18;
  kit.fill.setColor(colors.color.panel);
  canvas.drawRRect({ rect, rx: corner, ry: corner }, kit.fill);
  kit.stroke.setColor(colors.color.edge);
  kit.stroke.setStrokeWidth(edge);
  canvas.drawRRect({ rect, rx: corner, ry: corner }, kit.stroke);
}

/** The glow over a leaving tile is at most this strong, so the tile still shows through it. */
const GLOW_ALPHA = 0.7;

/** The glow of a closed loop over one of its tiles: not a tween of the tile, so only while it plays. */
function drawLoopGlow(canvas: SkCanvas, frame: Frame, at: { order: number; rect: Rect }): void {
  const loop = playingEntry(frame.fx, 'loop', loopEntity(at.order));
  if (loop === undefined) return;
  const alpha = GLOW_ALPHA * (1 - (loop.values[0] ?? 0));
  drawFace(canvas, frame, { rect: inset(at.rect, INSET), token: 'glow', alpha });
}

/**
 * A tile the view no longer holds, from its 'wipe' track ([size, loop, n, e, s, w]): the tile
 * itself (popping in if this move placed it) shrinks away, lit while the loop it closed in plays.
 */
function drawLeaving(canvas: SkCanvas, frame: Frame, at: { index: number; rect: Rect }): void {
  const { fx } = frame;
  const wipe = fxEntry(fx, 'wipe', cellEntity(at.index))?.values ?? [];
  const pop = fxEntry(fx, 'place', cellEntity(at.index))?.values[0] ?? 1;
  const size = (wipe[0] ?? 0) * pop;
  if (size < MIN_VISIBLE || wipe.length < 6) return;
  const rect = scaled(at.rect, size);
  drawTile(canvas, frame, { edges: wipe.slice(2), rect });
  drawLoopGlow(canvas, frame, { order: wipe[1] ?? -1, rect });
}

/** One cell: an empty slot, or its tile (a placed tile pops in, 'place' track), or a leaving tile. */
function drawCell(canvas: SkCanvas, frame: Frame, index: number): void {
  const rect = cellOf(frame, index);
  const edges = frame.view.cells[index] ?? [];
  if (rect === null) return;
  const { kit, colors, fx } = frame;
  if (edges.length > 0) {
    const pop = fxEntry(fx, 'place', cellEntity(index))?.values[0] ?? 1;
    drawTile(canvas, frame, { edges, rect: scaled(rect, pop) });
    return;
  }
  const corner = rect.width * 0.12;
  kit.fill.setColor(colors.color.cell);
  canvas.drawRRect({ rect: inset(rect, INSET * 2), rx: corner, ry: corner }, kit.fill);
  drawLeaving(canvas, frame, { index, rect });
}

/** A double: a ring spreads from the placed cell, then particles (full motion only). */
function drawDouble(canvas: SkCanvas, frame: Frame): void {
  const { kit, colors, fx } = frame;
  // Neither is a tween of something visible: each draws only while its track plays (linear time).
  const ring = playingEntry(fx, 'double', TURN_ENTITY);
  const burst = playingEntry(fx, 'burst', TURN_ENTITY);
  const cell = cellOf(frame, (ring ?? burst)?.values[0] ?? 0);
  if (cell === null) return;
  const cx = cell.x + cell.width / 2;
  const cy = cell.y + cell.height / 2;
  if (ring !== undefined) {
    const spread = ring.values[1] ?? 0;
    setPaintColor(kit.stroke, colors.color.glow, 1 - spread);
    kit.stroke.setStrokeWidth(cell.width * 0.1);
    canvas.drawCircle(cx, cy, cell.width * (0.5 + 1.2 * spread), kit.stroke);
  }
  if (burst === undefined) return;
  const spec = {
    seed: 0x7c1e,
    x: cx,
    y: cy,
    count: BURST_COUNT,
    minSpeed: 90,
    maxSpeed: 300,
    gravity: 380,
    lifeMs: 700,
  };
  for (let i = 0; i < spec.count; i += 1) {
    const particle = sampleParticle(spec, i, burst.ageMs);
    setPaintColor(kit.fill, colors.color.glow, particle.alpha);
    canvas.drawCircle(particle.x, particle.y, cell.width * 0.05, kit.fill);
  }
}

/** Pure worklet: reads only its arguments, allocates no Skia objects, reads no clock. */
export function drawBoard(canvas: SkCanvas, frame: Frame): void {
  canvas.drawColor(frame.colors.color.background);
  const board = frame.layout.regions[0];
  if (board === undefined) return;
  drawPanel(canvas, frame, board);
  for (let i = 0; i < frame.view.cells.length; i += 1) drawCell(canvas, frame, i);
  drawChoice(canvas, frame);
  drawHinted(canvas, frame);
  drawDouble(canvas, frame);
  drawTray(canvas, frame);
  drawGhost(canvas, frame);
}
