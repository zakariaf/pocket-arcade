// apps/tap-flip/src/board/draw-board.ts
'worklet';

import { cellRect } from '@e07/game-kit/geom/board-layout.ts';
import { sampleParticle } from '@e07/game-kit/timeline/particles.ts';
import { fxEntry } from '@e07/game-kit/timeline/sample.ts';
import { drawFittedText } from '@e07/shell/game-host/draw-centered-text.ts';

import { cellEntity, TURN_ENTITY } from './board-ids.ts';

import type { BoardToken } from './board-palettes.ts';
import type { TapFlipView } from './to-view.ts';
import type { Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { FxEntry } from '@e07/game-kit/timeline/sample.ts';
import type { DrawFrame } from '@e07/shell/game-host/board-types.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

type Frame = DrawFrame<TapFlipView, BoardToken>;

const CORNER = 0.16;
const INSET = 0.06;
const MARK_SCALE = 0.42;
const BURST_COUNT = 18;
/** A flipping cell never gets thinner than this share of its height (it stays visible). */
const MIN_FLIP = 0.06;
/** Width of a lit cell's ink edge, as a share of the cell. */
const EDGE = 0.05;

function inset(rect: Rect, share: number): Rect {
  const by = rect.width * share;
  return { x: rect.x + by, y: rect.y + by, width: rect.width - 2 * by, height: rect.height - 2 * by };
}

/** The whole grid's rectangle (first cell to last), or null before the canvas has a size. */
function boardRect(frame: Frame): Rect | null {
  const { cols, rows } = frame.view;
  const first = cellRect(frame.layout, { regionId: 'board', col: 0, row: 0 });
  const last = cellRect(frame.layout, { regionId: 'board', col: cols - 1, row: rows - 1 });
  if (first === null || last === null) return null;
  const x = Math.min(first.x, last.x);
  return { x, y: first.y, width: cols * first.width, height: last.y + last.height - first.y };
}

/** An effect that is not a tween of something visible draws only once its track has started. */
function isPlaying(entry: FxEntry | undefined): entry is FxEntry {
  return entry !== undefined && entry.ageMs > 0 && entry.progress < 1;
}

/** Lit cells carry a shape (the unit mark) as well as a colour: never colour alone. */
function drawMark(canvas: SkCanvas, frame: Frame, rect: Rect): void {
  const mark = frame.kit.paths['mark'];
  const size = rect.width * MARK_SCALE;
  frame.kit.fill.setColor(frame.colors.color.mark);
  if (mark === undefined) {
    canvas.drawCircle(rect.x + rect.width / 2, rect.y + rect.height / 2, size / 2, frame.kit.fill);
    return;
  }
  canvas.save();
  canvas.translate(rect.x + (rect.width - size) / 2, rect.y + (rect.height - size) / 2);
  canvas.scale(size, size);
  canvas.drawPath(mark, frame.kit.fill);
  canvas.restore();
}

/** One cell; a flip track turns it over: |v| is its height, the sign which face shows. */
function drawCell(canvas: SkCanvas, frame: Frame, index: number): void {
  const { view, colors, kit, fx } = frame;
  const col = index % view.cols;
  const rect = cellRect(frame.layout, { regionId: 'board', col, row: Math.floor(index / view.cols) });
  if (rect === null) return;
  const turn = fxEntry(fx, 'flip', cellEntity(index))?.values[0] ?? 1;
  const isLitNow = view.cells[index] === 1;
  const isLitShown = turn < 0 ? !isLitNow : isLitNow;
  const face = inset(rect, INSET);
  const height = face.height * Math.max(MIN_FLIP, Math.abs(turn));
  const shown = { ...face, y: face.y + (face.height - height) / 2, height };
  const corner = rect.width * CORNER;
  kit.fill.setColor(isLitShown ? colors.color.lit : colors.color.cell);
  canvas.drawRRect({ rect: shown, rx: corner, ry: corner }, kit.fill);
  if (!isLitShown) return;
  // Toybox fills carry an ink edge: it is what keeps a lit cell 3:1 off the ground (board-contrast.json).
  kit.stroke.setColor(colors.color.edge);
  kit.stroke.setStrokeWidth(Math.max(1, rect.width * EDGE));
  canvas.drawRRect({ rect: shown, rx: corner, ry: corner }, kit.stroke);
  if (Math.abs(turn) > 0.5) drawMark(canvas, frame, face);
}

/** The host's hinted move: a ring around each hinted cell (EMPTY_HIGHLIGHT draws nothing). */
function drawHinted(canvas: SkCanvas, frame: Frame): void {
  const { kit, colors } = frame;
  for (const target of frame.highlight.hinted) {
    const rect = target.regionId === 'board' ? cellRect(frame.layout, target) : null;
    if (rect === null) continue;
    kit.stroke.setColor(colors.color.hint);
    kit.stroke.setStrokeWidth(Math.max(2, rect.width * 0.08));
    const ring = inset(rect, INSET / 2);
    canvas.drawRRect({ rect: ring, rx: rect.width * CORNER, ry: rect.width * CORNER }, kit.stroke);
  }
}

/** The board went dark: a fading glow, then particles from its centre (full motion only). */
function drawClear(canvas: SkCanvas, frame: Frame, board: Rect): void {
  const { kit, colors, fx } = frame;
  const glow = fxEntry(fx, 'glow', TURN_ENTITY);
  if (isPlaying(glow)) {
    kit.fill.setColor(colors.color.glow);
    kit.fill.setAlphaf((glow.values[0] ?? 0) * 0.6);
    canvas.drawRRect({ rect: board, rx: 12, ry: 12 }, kit.fill);
    kit.fill.setAlphaf(1);
  }
  const burst = fxEntry(fx, 'burst', TURN_ENTITY);
  if (!isPlaying(burst)) return;
  const spec = {
    seed: frame.view.cols * 31 + frame.view.rows,
    x: board.x + board.width / 2,
    y: board.y + board.height / 2,
    count: BURST_COUNT,
    minSpeed: 80,
    maxSpeed: 260,
    gravity: 420,
    lifeMs: 700,
  };
  kit.fill.setColor(colors.color.glow);
  for (let i = 0; i < spec.count; i += 1) {
    const particle = sampleParticle(spec, i, burst.ageMs);
    kit.fill.setAlphaf(particle.alpha);
    canvas.drawCircle(particle.x, particle.y, board.width * 0.012, kit.fill);
  }
  kit.fill.setAlphaf(1);
}

/** A continue added moves: the moves-left number pops in the middle of the board. */
function drawBonus(canvas: SkCanvas, frame: Frame, board: Rect): void {
  const bonus = fxEntry(frame.fx, 'bonus', TURN_ENTITY);
  const font = frame.kit.numberFont;
  if (!isPlaying(bonus) || font === null) return;
  const size = (board.width / 3) * (bonus.values[0] ?? 1);
  const rect = {
    x: board.x + (board.width - size) / 2,
    y: board.y + (board.height - size) / 2,
    width: size,
    height: size,
  };
  frame.kit.fill.setColor(frame.colors.color.label);
  drawFittedText(canvas, { text: frame.view.movesLeftText, rect }, { font, paint: frame.kit.fill });
}

/** Pure worklet: reads only its arguments, allocates no Skia objects, reads no clock. */
export function drawBoard(canvas: SkCanvas, frame: Frame): void {
  canvas.drawColor(frame.colors.color.background);
  for (let i = 0; i < frame.view.cells.length; i += 1) drawCell(canvas, frame, i);
  drawHinted(canvas, frame);
  const board = boardRect(frame);
  if (board === null) return;
  drawClear(canvas, frame, board);
  drawBonus(canvas, frame, board);
}
