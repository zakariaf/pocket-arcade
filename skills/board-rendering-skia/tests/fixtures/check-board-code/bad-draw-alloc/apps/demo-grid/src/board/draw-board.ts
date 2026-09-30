// apps/demo-grid/src/board/draw-board.ts
'worklet';

import { cellRect } from '@e07/game-kit/geom/board-layout.ts';
import { sampleParticle } from '@e07/game-kit/timeline/particles.ts';
import { fxEntry } from '@e07/game-kit/timeline/sample.ts';
import { drawCenteredText } from '@e07/shell/game-host/draw-centered-text.ts';

import { cellEntity } from './board-ids.ts';

import type { BoardToken } from './board-palettes.ts';
import type { DemoGridView } from './to-view.ts';
import type { Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { DrawFrame } from '@e07/shell/game-host/board-types.ts';
import { Skia } from '@shopify/react-native-skia';

import type { SkCanvas } from '@shopify/react-native-skia';

type Frame = DrawFrame<DemoGridView, BoardToken>;

const CORNER = 0.14;
const INSET = 0.06;
const PIECE_SCALE = 0.76;
const BURST_COUNT = 14;

/** Cell rectangle at a (possibly fractional, mid-animation) grid position. */
function cellAt(frame: Frame, col: number, row: number): Rect | null {
  return cellRect(frame.layout, { regionId: 'board', col, row });
}

function drawCells(canvas: SkCanvas, frame: Frame): void {
  const { view, colors, kit, fx } = frame;
  for (let i = 0; i < view.cells.length; i += 1) {
    const col = i % view.cols;
    const row = Math.floor(i / view.cols);
    const rect = cellAt(frame, col, row);
    if (rect === null) continue;
    const isFilled = view.cells[i] !== 0;
    const pop = isFilled ? (fxEntry(fx, 'pop', cellEntity(col, row))?.values[0] ?? 1) : 1;
    const inset = rect.width * (INSET + (1 - pop) / 2);
    kit.fill.setColor(isFilled ? colors.color.filled : colors.color.cell);
    const inner = {
      x: rect.x + inset,
      y: rect.y + inset,
      width: rect.width - 2 * inset,
      height: rect.height - 2 * inset,
    };
    canvas.drawRRect({ rect: inner, rx: rect.width * CORNER, ry: rect.width * CORNER }, kit.fill);
  }
}

/** Draws the unit-size piece path (built once in buildPaths) scaled into a cell. */
function drawPieceShape(canvas: SkCanvas, frame: Frame, rect: Rect): void {
  const shape = frame.kit.paths['piece'];
  const size = rect.width * PIECE_SCALE;
  if (shape === undefined) {
    canvas.drawCircle(rect.x + rect.width / 2, rect.y + rect.height / 2, size / 2, frame.kit.fill);
    return;
  }
  canvas.save();
  canvas.translate(rect.x + (rect.width - size) / 2, rect.y + (rect.height - size) / 2);
  canvas.scale(size, size);
  canvas.drawPath(shape, frame.kit.fill);
  canvas.restore();
}

function drawPieces(canvas: SkCanvas, frame: Frame): void {
  const { view, colors, kit, fx } = frame;
  for (const piece of view.pieces) {
    const pos = fxEntry(fx, 'pos', piece.id)?.values;
    const rect = cellAt(frame, pos?.[0] ?? piece.col, pos?.[1] ?? piece.row);
    if (rect === null) continue;
    kit.fill.setColor(colors.color.piece);
    drawPieceShape(canvas, frame, rect);
    if (kit.numberFont === null) continue;
    kit.fill.setColor(colors.color.label);
    const label = {
      text: piece.label,
      cx: rect.x + rect.width / 2,
      y: rect.y + rect.height * 0.62,
    };
    drawCenteredText(canvas, label, { font: kit.numberFont, paint: kit.fill });
  }
}

/** Removed pieces are not in the view: they are drawn from their 'gone' tracks alone. */
function drawGone(canvas: SkCanvas, frame: Frame): void {
  const { fx, colors, kit } = frame;
  for (const key of Object.keys(fx.entries)) {
    const gone = fx.entries[key];
    if (!key.startsWith('gone:') || gone === undefined || gone.progress >= 1) continue;
    const rect = cellAt(frame, gone.values[0] ?? 0, gone.values[1] ?? 0);
    if (rect === null) continue;
    kit.fill.setColor(colors.color.piece);
    kit.fill.setAlphaf(gone.values[2] ?? 0);
    drawPieceShape(canvas, frame, rect);
    kit.fill.setAlphaf(1);
  }
}

/** Stateless particles: every position is a pure function of (burst, index, age). */
function drawBursts(canvas: SkCanvas, frame: Frame): void {
  const { fx, colors, kit } = frame;
  for (const key of Object.keys(fx.entries)) {
    const burst = fx.entries[key];
    if (!key.startsWith('burst:') || burst === undefined || burst.progress >= 1) continue;
    const rect = cellAt(frame, burst.values[0] ?? 0, burst.values[1] ?? 0);
    if (rect === null || burst.ageMs <= 0) continue;
    const spec = {
      seed: Number(key.slice('burst:'.length)),
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
      count: BURST_COUNT,
      minSpeed: 60,
      maxSpeed: 220,
      gravity: 400,
      lifeMs: 600,
    };
    kit.fill.setColor(colors.color.effect);
    for (let i = 0; i < spec.count; i += 1) {
      const particle = sampleParticle(spec, i, burst.ageMs);
      kit.fill.setAlphaf(particle.alpha);
      canvas.drawCircle(particle.x, particle.y, rect.width * 0.06, kit.fill);
    }
    kit.fill.setAlphaf(1);
  }
}

/** Hover highlight while a finger is down (pointer comes from the gesture worklets, not React). */
function drawGhost(canvas: SkCanvas, frame: Frame): void {
  const { pointer } = frame.fx;
  if (!pointer.isDown || pointer.hover?.regionId !== 'board') return;
  const rect = cellRect(frame.layout, pointer.hover);
  if (rect === null) return;
  frame.kit.fill.setColor(frame.colors.color.ghost);
  canvas.drawRRect({ rect, rx: rect.width * CORNER, ry: rect.width * CORNER }, frame.kit.fill);
}

/** Pure worklet: reads only its arguments, allocates no Skia objects, reads no clock. */
export function drawBoard(canvas: SkCanvas, frame: Frame): void {
  canvas.drawColor(Skia.Color('#101010'));
  drawCells(canvas, frame);
  drawPieces(canvas, frame);
  drawGone(canvas, frame);
  drawBursts(canvas, frame);
  drawGhost(canvas, frame);
}
