// apps/merge-siege/src/board/draw-pieces.ts
'worklet';

import { cellRect } from '@e07/game-kit/geom/board-layout.ts';
import { setPaintColor } from '@e07/shell/game-host/board-kit.ts';
import { textWidth } from '@e07/shell/game-host/draw-centered-text.ts';

import { ENEMY_KIND, digitsOf } from './board-ids.ts';

import type { BoardToken } from './board-palettes.ts';
import type { MergeSiegeView } from './to-view.ts';
import type { Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { DrawFrame } from '@e07/shell/game-host/board-types.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

export type Frame = DrawFrame<MergeSiegeView, BoardToken>;

/** A piece as one frame shows it: where (fractional rows are mid-move), its number, alpha, scale. */
export type Shown = {
  readonly kind: number;
  readonly value: number;
  readonly col: number;
  readonly row: number;
  readonly alpha: number;
  readonly scale: number;
};

/** A piece fills this share of its cell. */
const PIECE = 0.84;
const TILE_CORNER = 0.2;
/** Width of the ink edge, as a share of the piece. */
const EDGE = 0.05;
/**
 * The box a piece's number fills, as shares of the piece: [width, height]. The number is the
 * piece's main fact, so it grows to fill the box (the shared drawFittedText only ever shrinks).
 * An enemy's box sits inside the notches of its spikes.
 */
const TILE_TEXT = [0.78, 0.4] as const;
const ENEMY_TEXT = [0.52, 0.36] as const;
/** Digits sit about this share of the font size above their baseline's centre line. */
const DIGIT_CENTRE = 0.36;
/**
 * Below this a piece is not drawn: an eased fade-in starts a hair above 0 (out-back at 0 is
 * 2.2e-16), and an invisible piece must not draw its number.
 */
const MIN_ALPHA = 0.01;

function pieceRect(cell: Rect, scale: number): Rect {
  const size = cell.width * PIECE * scale;
  return {
    x: cell.x + (cell.width - size) / 2,
    y: cell.y + (cell.height - size) / 2,
    width: size,
    height: size,
  };
}

/** A tile: a rounded square with an ink edge (the shape that tells it from an enemy). */
function drawTileBody(canvas: SkCanvas, frame: Frame, at: { rect: Rect; alpha: number }): void {
  const { kit, colors } = frame;
  const radius = at.rect.width * TILE_CORNER;
  setPaintColor(kit.fill, colors.color.tile, at.alpha);
  canvas.drawRRect({ rect: at.rect, rx: radius, ry: radius }, kit.fill);
  setPaintColor(kit.stroke, colors.color.edge, at.alpha);
  kit.stroke.setStrokeWidth(Math.max(1, at.rect.width * EDGE));
  canvas.drawRRect({ rect: at.rect, rx: radius, ry: radius }, kit.stroke);
}

/** An enemy: the spiky unit path with an ink edge (a round body when the kit has no path). */
function drawEnemyBody(canvas: SkCanvas, frame: Frame, at: { rect: Rect; alpha: number }): void {
  const { kit, colors } = frame;
  const { rect } = at;
  const spikes = kit.paths['enemy'];
  setPaintColor(kit.fill, colors.color.enemy, at.alpha);
  setPaintColor(kit.stroke, colors.color.edge, at.alpha);
  if (spikes === undefined) {
    const radius = rect.width / 2;
    kit.stroke.setStrokeWidth(Math.max(1, rect.width * EDGE));
    canvas.drawRRect({ rect, rx: radius, ry: radius }, kit.fill);
    canvas.drawRRect({ rect, rx: radius, ry: radius }, kit.stroke);
    return;
  }
  canvas.save();
  canvas.translate(rect.x, rect.y);
  canvas.scale(rect.width, rect.width);
  // The canvas is scaled to the unit path: the stroke width is in units of the piece.
  kit.stroke.setStrokeWidth(Math.max(1 / rect.width, EDGE));
  canvas.drawPath(spikes, kit.fill);
  canvas.drawPath(spikes, kit.stroke);
  canvas.restore();
}

/** The piece's number in the chosen digits, centred and scaled to fill its box in the body. */
function drawNumber(canvas: SkCanvas, frame: Frame, piece: Shown & { readonly rect: Rect }): void {
  const font = frame.kit.numberFont;
  const text = digitsOf(frame.view, piece.value);
  const width = font === null ? 0 : textWidth(font, text);
  if (font === null || width <= 0) return;
  const isEnemy = piece.kind === ENEMY_KIND;
  const [widthShare, heightShare] = isEnemy ? ENEMY_TEXT : TILE_TEXT;
  const size = font.getSize();
  const scale = Math.min(
    (piece.rect.width * widthShare) / width,
    (piece.rect.height * heightShare) / size,
  );
  const ink = isEnemy ? frame.colors.color.enemyInk : frame.colors.color.tileInk;
  setPaintColor(frame.kit.fill, ink, piece.alpha);
  canvas.save();
  canvas.translate(
    piece.rect.x + piece.rect.width / 2,
    piece.rect.y + piece.rect.height / 2 + size * scale * DIGIT_CENTRE,
  );
  canvas.scale(scale, scale);
  canvas.drawText(text, 0 - width / 2, 0, frame.kit.fill, font);
  canvas.restore();
}

/** One tile or enemy where this frame shows it; nothing when it is invisible. */
export function drawPiece(canvas: SkCanvas, frame: Frame, piece: Shown): void {
  const cell = cellRect(frame.layout, { regionId: 'board', col: piece.col, row: piece.row });
  if (cell === null || piece.alpha < MIN_ALPHA || piece.scale <= 0) return;
  const rect = pieceRect(cell, piece.scale);
  if (piece.kind === ENEMY_KIND) drawEnemyBody(canvas, frame, { rect, alpha: piece.alpha });
  else drawTileBody(canvas, frame, { rect, alpha: piece.alpha });
  drawNumber(canvas, frame, { ...piece, rect });
  frame.kit.fill.setAlphaf(1);
  frame.kit.stroke.setAlphaf(1);
}
