// apps/merge-siege/src/board/draw-board.ts
'worklet';

import { cellRect } from '@e07/game-kit/geom/board-layout.ts';
import { sampleParticle } from '@e07/game-kit/timeline/particles.ts';
import { fxEntry } from '@e07/game-kit/timeline/sample.ts';
import { setPaintColor } from '@e07/shell/game-host/board-kit.ts';

import { ENEMY_KIND, KIND_FROM_VIEW, NEXT_ENTITY, VALUE_FROM_VIEW } from './board-ids.ts';
import { drawPiece } from './draw-pieces.ts';

import type { Frame, Shown } from './draw-pieces.ts';
import type { PieceView } from './to-view.ts';
import type { Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { FxEntry } from '@e07/game-kit/timeline/sample.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

const CELL_INSET = 0.05;
const CELL_CORNER = 0.16;
const FRAME_PAD = 0.06;
const BURST_COUNT = 12;
const PIECE_KEY = 'piece:';
const BURST_KEY = 'burst:';

function inset(rect: Rect, by: number): Rect {
  return {
    x: rect.x + by,
    y: rect.y + by,
    width: rect.width - 2 * by,
    height: rect.height - 2 * by,
  };
}

/** The rectangle of a whole region (first cell to last), or null before the canvas has a size. */
function regionRect(
  frame: Frame,
  region: { readonly id: string; readonly rows: number },
): Rect | null {
  const { cols } = frame.view;
  const first = cellRect(frame.layout, { regionId: region.id, col: 0, row: 0 });
  const last = cellRect(frame.layout, { regionId: region.id, col: cols - 1, row: region.rows - 1 });
  if (first === null || last === null) return null;
  const x = Math.min(first.x, last.x);
  return { x, y: first.y, width: cols * first.width, height: last.y + last.height - first.y };
}

/** An effect that is not a tween of something visible draws only once its track has started. */
function isPlaying(entry: FxEntry | undefined): entry is FxEntry {
  return entry !== undefined && entry.ageMs > 0 && entry.progress < 1;
}

/** A filled rounded rectangle with the ink edge. */
function drawPanel(
  canvas: SkCanvas,
  frame: Frame,
  panel: { rect: Rect; fill: 'floor' | 'gate' },
): void {
  const { kit, colors } = frame;
  const radius = (frame.layout.regions[0]?.cell ?? 0) * 0.22;
  kit.fill.setColor(colors.color[panel.fill]);
  canvas.drawRRect({ rect: panel.rect, rx: radius, ry: radius }, kit.fill);
  kit.stroke.setColor(colors.color.edge);
  kit.stroke.setStrokeWidth(Math.max(1.5, radius * 0.18));
  canvas.drawRRect({ rect: panel.rect, rx: radius, ry: radius }, kit.stroke);
}

/** The gate strip, the board's floor and its cells; the bottom row is the player's base. */
function drawGround(canvas: SkCanvas, frame: Frame): void {
  const { view, kit, colors } = frame;
  const gate = regionRect(frame, { id: 'gate', rows: 1 });
  const board = regionRect(frame, { id: 'board', rows: view.rows });
  if (gate === null || board === null) return;
  const pad = (board.width / view.cols) * FRAME_PAD;
  drawPanel(canvas, frame, { rect: inset(gate, pad), fill: 'gate' });
  drawPanel(canvas, frame, { rect: inset(board, -pad), fill: 'floor' });
  for (let row = 0; row < view.rows; row += 1) {
    kit.fill.setColor(row === view.rows - 1 ? colors.color.base : colors.color.cell);
    for (let col = 0; col < view.cols; col += 1) {
      const rect = cellRect(frame.layout, { regionId: 'board', col, row });
      if (rect === null) continue;
      const corner = rect.width * CELL_CORNER;
      canvas.drawRRect(
        { rect: inset(rect, rect.width * CELL_INSET), rx: corner, ry: corner },
        kit.fill,
      );
    }
  }
}

/** One value of a sampled track, or a fallback when the track has none at that place. */
function valueAt(values: readonly number[], index: number, fallback: number): number {
  return values[index] ?? fallback;
}

/** [col, row, value, kind, alpha, scale] of a 'piece' track (board-ids.ts), over defaults. */
function pieceValues(values: readonly number[], base: Shown): Shown {
  return {
    col: valueAt(values, 0, base.col),
    row: valueAt(values, 1, base.row),
    value: valueAt(values, 2, base.value),
    kind: valueAt(values, 3, base.kind),
    alpha: valueAt(values, 4, base.alpha),
    scale: valueAt(values, 5, base.scale),
  };
}

/** A piece of the final view, where its track (if any) shows it this frame. */
function shownOf(piece: PieceView, entry: FxEntry | undefined): Shown {
  const atRest = { ...piece, alpha: 1, scale: 1 };
  if (entry === undefined) return atRest;
  const shown = pieceValues(entry.values, atRest);
  return {
    ...shown,
    value: shown.value === VALUE_FROM_VIEW ? piece.value : shown.value,
    kind: shown.kind === KIND_FROM_VIEW ? piece.kind : shown.kind,
  };
}

const UNNAMED: Shown = {
  col: 0,
  row: 0,
  value: VALUE_FROM_VIEW,
  kind: KIND_FROM_VIEW,
  alpha: 0,
  scale: 1,
};

/** A piece gone from the view (smashed, merged away, lost), from its track; null if none. */
function vanishedAt(frame: Frame, key: string): Shown | null {
  if (!key.startsWith(PIECE_KEY)) return null;
  const id = Number(key.slice(PIECE_KEY.length));
  if (frame.view.pieces.some((piece) => piece.id === id)) return null;
  const shown = pieceValues(frame.fx.entries[key]?.values ?? [], UNNAMED);
  return shown.value === VALUE_FROM_VIEW || shown.kind === KIND_FROM_VIEW ? null : shown;
}

/** Pieces gone from the view: their tracks carry where, which number and how faded. */
function drawVanished(canvas: SkCanvas, frame: Frame): void {
  for (const key of Object.keys(frame.fx.entries)) {
    const piece = vanishedAt(frame, key);
    if (piece !== null) drawPiece(canvas, frame, piece);
  }
}

/** The enemy waiting in the gate; after an entry it fades in once the last one has stepped down. */
function drawNext(canvas: SkCanvas, frame: Frame): void {
  const { next } = frame.view;
  if (next === null) return;
  const alpha = fxEntry(frame.fx, 'next', NEXT_ENTITY)?.values[0] ?? 1;
  const enemy = { kind: ENEMY_KIND, value: next.value, col: next.col, row: -1 };
  drawPiece(canvas, frame, { ...enemy, alpha, scale: 1 });
}

/** Particles where an enemy was smashed (full motion only: reduced motion has no burst track). */
function drawBursts(canvas: SkCanvas, frame: Frame): void {
  const { kit, colors, fx } = frame;
  for (const key of Object.keys(fx.entries)) {
    const burst = fx.entries[key];
    if (!key.startsWith(BURST_KEY) || !isPlaying(burst)) continue;
    const [col = 0, row = 0] = burst.values;
    const cell = cellRect(frame.layout, { regionId: 'board', col, row });
    if (cell === null) continue;
    const spec = {
      seed: Number(key.slice(BURST_KEY.length)) * 31 + col,
      x: cell.x + cell.width / 2,
      y: cell.y + cell.height / 2,
      count: BURST_COUNT,
      minSpeed: 60,
      maxSpeed: 200,
      gravity: 380,
      lifeMs: 500,
    };
    for (let i = 0; i < spec.count; i += 1) {
      const particle = sampleParticle(spec, i, burst.ageMs);
      setPaintColor(kit.fill, colors.color.burst, particle.alpha);
      canvas.drawCircle(particle.x, particle.y, cell.width * 0.07, kit.fill);
    }
    kit.fill.setAlphaf(1);
  }
}

/** The host's hinted targets: a ring around each (EMPTY_HIGHLIGHT draws nothing). */
function drawHinted(canvas: SkCanvas, frame: Frame): void {
  const { kit, colors } = frame;
  for (const target of frame.highlight.hinted) {
    const rect = cellRect(frame.layout, target);
    if (rect === null) continue;
    kit.stroke.setColor(colors.color.hint);
    kit.stroke.setStrokeWidth(Math.max(2, rect.width * 0.08));
    const corner = rect.width * CELL_CORNER;
    canvas.drawRRect({ rect: inset(rect, rect.width * 0.03), rx: corner, ry: corner }, kit.stroke);
  }
}

/** Pure worklet: reads only its arguments, allocates no Skia objects, reads no clock. */
export function drawBoard(canvas: SkCanvas, frame: Frame): void {
  canvas.drawColor(frame.colors.color.background);
  drawGround(canvas, frame);
  drawVanished(canvas, frame);
  for (const piece of frame.view.pieces)
    drawPiece(canvas, frame, shownOf(piece, fxEntry(frame.fx, 'piece', piece.id)));
  drawNext(canvas, frame);
  drawBursts(canvas, frame);
  drawHinted(canvas, frame);
}
