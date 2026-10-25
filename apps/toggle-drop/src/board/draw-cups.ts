// apps/toggle-drop/src/board/draw-cups.ts
'worklet';

import { sampleParticle } from '@e07/game-kit/timeline/particles.ts';
import { fxEntry } from '@e07/game-kit/timeline/sample.ts';
import { setPaintColor } from '@e07/shell/game-host/board-kit.ts';
import { drawFittedText } from '@e07/shell/game-host/draw-centered-text.ts';

import { BALL_ENTITY, cupEntity } from './board-ids.ts';
import { unitPoint } from './layout-board.ts';

import type { BoardToken } from './board-palettes.ts';
import type { ToggleDropView } from './to-view.ts';
import type { GridRegion, Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { FxEntry } from '@e07/game-kit/timeline/sample.ts';
import type { DrawFrame } from '@e07/shell/game-host/board-types.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

type Frame = DrawFrame<ToggleDropView, BoardToken>;

/** The cell under one column, below the last peg row. */
type CupSpot = { readonly cell: Rect; readonly col: number };

/** What a cup shows: its balls, the balls it needs, and the number it still needs. */
type CupContent = {
  readonly cell: Rect;
  readonly shown: number;
  readonly need: number;
  readonly text: string;
};

/** Shares of a cell. */
const CUP = 0.8;
const BALL = 0.21;
const HELD_BALL = 0.085;
const HELD_STEP = 0.19;
/** Height of the slots' centres in the cup's cell (above the cup's narrow bottom). */
const SLOT_Y = 0.6;
const EDGE = 0.045;
const BURST_COUNT = 14;

/** An effect that is not a tween of something visible draws only once its track has started. */
export function isPlaying(entry: FxEntry | undefined): entry is FxEntry {
  return entry !== undefined && entry.ageMs > 0 && entry.progress < 1;
}

function setEdge(frame: Frame, width: number): void {
  frame.kit.stroke.setColor(frame.colors.color.edge);
  frame.kit.stroke.setStrokeWidth(Math.max(1, width * EDGE));
}

/** The gutter: a flat line where a ball is lost, with a puff while one lands there. */
function drawGutter(canvas: SkCanvas, frame: Frame, spot: CupSpot): void {
  const { kit, colors } = frame;
  const { cell } = spot;
  kit.stroke.setColor(colors.color.chute);
  kit.stroke.setStrokeWidth(Math.max(1, cell.width * EDGE));
  const y = cell.y + cell.height * 0.78;
  canvas.drawLine(cell.x + cell.width * 0.3, y, cell.x + cell.width * 0.7, y, kit.stroke);
  const miss = fxEntry(frame.fx, 'miss', cupEntity(spot.col));
  if (!isPlaying(miss)) return;
  const left = miss.values[0] ?? 0;
  setPaintColor(kit.stroke, colors.color.chute, left);
  canvas.drawCircle(cell.x + cell.width / 2, y, cell.width * (0.4 - 0.2 * left), kit.stroke);
}

/**
 * A slot per ball the cup needs, in a row along its bottom: a held ball is an edged dot, a ball
 * still needed an empty ring (so a cup reads by shape at any size, not by its number alone).
 */
function drawHeldBalls(canvas: SkCanvas, frame: Frame, content: CupContent): void {
  const { kit, colors } = frame;
  const { cell } = content;
  const step = Math.min(HELD_STEP, 0.4 / Math.max(1, content.need - 1));
  const r = cell.width * Math.min(HELD_BALL, step * 0.45);
  setEdge(frame, cell.width);
  kit.fill.setColor(colors.color.ball);
  for (let i = 0; i < content.need; i += 1) {
    const x = cell.x + cell.width * (0.5 + (i - (content.need - 1) / 2) * step);
    const y = cell.y + cell.height * SLOT_Y;
    if (i < content.shown) canvas.drawCircle(x, y, r, kit.fill);
    canvas.drawCircle(x, y, r, kit.stroke);
  }
}

/** A full cup shows a check (a shape, never colour alone); any other cup the balls it still needs. */
function drawCupMark(canvas: SkCanvas, frame: Frame, content: CupContent): void {
  const { kit, colors } = frame;
  const { cell } = content;
  const check = kit.paths['check'];
  kit.fill.setColor(colors.color.label);
  if (content.shown >= content.need && check !== undefined) {
    const size = cell.width * 0.28;
    canvas.save();
    canvas.translate(cell.x + (cell.width - size) / 2, cell.y + cell.height * 0.2);
    canvas.scale(size, size);
    canvas.drawPath(check, kit.fill);
    canvas.restore();
    return;
  }
  const font = kit.numberFont;
  if (font === null || content.text === '') return;
  const rect = {
    x: cell.x + cell.width * 0.3,
    y: cell.y + cell.height * 0.21,
    width: cell.width * 0.4,
    height: cell.height * 0.28,
  };
  drawFittedText(canvas, { text: content.text, rect }, { font, paint: kit.fill });
}

/** The cup's U in the cup paint with its ink edge, scaled while it pops. */
function drawCupShape(canvas: SkCanvas, frame: Frame, at: { cell: Rect; scale: number }): void {
  const { kit, colors } = frame;
  const shape = kit.paths['cup'];
  if (shape === undefined) return;
  const size = at.cell.width * CUP * at.scale;
  canvas.save();
  canvas.translate(at.cell.x + (at.cell.width - size) / 2, at.cell.y + (at.cell.height - size) / 2);
  canvas.scale(size, size);
  kit.fill.setColor(colors.color.cup);
  canvas.drawPath(shape, kit.fill);
  setEdge(frame, at.cell.width);
  kit.stroke.setStrokeWidth(Math.max(1, at.cell.width * EDGE) / size);
  canvas.drawPath(shape, kit.stroke);
  canvas.restore();
}

/**
 * A cup: it pops when it takes the ball. The view is the final state, so while the move's ball
 * still falls toward this cup (its catch track has not started) it shows one ball fewer.
 */
function drawCup(canvas: SkCanvas, frame: Frame, spot: CupSpot): void {
  const { view } = frame;
  const caught = fxEntry(frame.fx, 'catch', cupEntity(spot.col));
  const scale = isPlaying(caught) ? (caught.values[0] ?? 1) : 1;
  const isPending = caught !== undefined && caught.ageMs <= 0;
  drawCupShape(canvas, frame, { cell: spot.cell, scale });
  const filled = view.filled[spot.col] ?? 0;
  const content: CupContent = {
    cell: spot.cell,
    shown: isPending ? filled - 1 : filled,
    need: view.needs[spot.col] ?? 0,
    text: (isPending ? view.pendingTexts : view.needTexts)[spot.col] ?? '',
  };
  drawHeldBalls(canvas, frame, content);
  drawCupMark(canvas, frame, content);
}

/** A full cup bursts: particles from its middle (full motion only: reduced motion has no track). */
function drawBurst(canvas: SkCanvas, frame: Frame, spot: CupSpot): void {
  const burst = fxEntry(frame.fx, 'burst', cupEntity(spot.col));
  if (!isPlaying(burst)) return;
  const { cell } = spot;
  const spec = {
    seed: spot.col * 31 + frame.view.rows,
    x: cell.x + cell.width / 2,
    y: cell.y + cell.height / 2,
    count: BURST_COUNT,
    minSpeed: 60,
    maxSpeed: 200,
    gravity: 380,
    lifeMs: 650,
  };
  for (let i = 0; i < spec.count; i += 1) {
    const particle = sampleParticle(spec, i, burst.ageMs);
    setPaintColor(frame.kit.fill, frame.colors.color.ball, particle.alpha);
    canvas.drawCircle(particle.x, particle.y, cell.width * 0.04, frame.kit.fill);
  }
}

/** Every column's cup or gutter, below the last peg row. */
export function drawCups(canvas: SkCanvas, frame: Frame, region: GridRegion): void {
  const y = region.y + (frame.view.rows + 1) * region.cell;
  for (let col = 0; col < frame.view.cols; col += 1) {
    const cell = { x: region.x + col * region.cell, y, width: region.cell, height: region.cell };
    const spot = { cell, col };
    if ((frame.view.needs[col] ?? 0) === 0) drawGutter(canvas, frame, spot);
    else drawCup(canvas, frame, spot);
    drawBurst(canvas, frame, spot);
  }
}

/** The falling ball, replayed along its tracks; it melts away as it lands (its fade track). */
export function drawBall(canvas: SkCanvas, frame: Frame, region: GridRegion): void {
  const ball = fxEntry(frame.fx, 'ball', BALL_ENTITY);
  if (ball === undefined) return;
  const alpha = fxEntry(frame.fx, 'fade', BALL_ENTITY)?.values[0] ?? 1;
  if (alpha <= 0) return;
  const at = unitPoint(region, ball.values[0] ?? 0, ball.values[1] ?? 0);
  const radius = region.cell * BALL;
  setPaintColor(frame.kit.fill, frame.colors.color.ball, alpha);
  canvas.drawCircle(at.x, at.y, radius, frame.kit.fill);
  setEdge(frame, region.cell);
  setPaintColor(frame.kit.stroke, frame.colors.color.edge, alpha);
  canvas.drawCircle(at.x, at.y, radius, frame.kit.stroke);
}
