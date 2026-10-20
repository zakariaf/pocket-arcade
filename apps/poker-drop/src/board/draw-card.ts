// apps/poker-drop/src/board/draw-card.ts
'worklet';

import { textWidth } from '@e07/shell/game-host/draw-centered-text.ts';

import { rankText, suitName } from './board-ids.ts';

import type { Frame } from './draw-parts.ts';
import type { Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { SkCanvas, SkColor, SkFont, SkPaint } from '@shopify/react-native-skia';

/** Corner radius and ink edge of a card, as shares of its width. */
const CORNER = 0.14;
const EDGE = 0.05;
/** The index fills the top of the face, the suit sits under it. */
const RANK_BOX = { top: 0.08, height: 0.44, side: 0.12 } as const;
const SUIT_BOX = { top: 0.56, size: 0.4 } as const;
/** Digits and capitals sit about this share of the font size above their baseline's centre line. */
const CAP_CENTRE = 0.36;

/** One card to draw: its face, its rect and how opaque it is (1 = fully). */
export type CardFace = { readonly card: number; readonly rect: Rect; readonly alpha: number };

type Ink = { readonly font: SkFont; readonly paint: SkPaint };

/** A text and the box it is scaled into. */
export type BoxedText = { readonly text: string; readonly box: Rect };

/**
 * Text scaled to fill `box` (grown or shrunk): the kit has one number size, smaller than a card's
 * index. Glyph widths measure it (SkFont.measureText is missing in CanvasKit).
 */
export function drawScaledText(canvas: SkCanvas, label: BoxedText, ink: Ink): void {
  const { text, box } = label;
  const width = textWidth(ink.font, text);
  const size = ink.font.getSize();
  if (width <= 0 || size <= 0) return;
  const scale = Math.min(box.width / width, box.height / size);
  canvas.save();
  canvas.translate(box.x + box.width / 2, box.y + box.height / 2 + size * scale * CAP_CENTRE);
  canvas.scale(scale, scale);
  canvas.drawText(text, 0 - width / 2, 0, ink.paint, ink.font);
  canvas.restore();
}

function setFill(frame: Frame, color: SkColor, alpha: number): SkPaint {
  frame.kit.fill.setColor(color);
  frame.kit.fill.setAlphaf(alpha);
  return frame.kit.fill;
}

/** The suit as its unit path (a circle when the kit has none), so suits differ by shape. */
function drawSuit(canvas: SkCanvas, frame: Frame, face: CardFace): void {
  const suit = suitName(face.card);
  const size = face.rect.width * SUIT_BOX.size;
  const x = face.rect.x + (face.rect.width - size) / 2;
  const y = face.rect.y + face.rect.height * SUIT_BOX.top;
  const paint = setFill(frame, frame.colors.color[suit], face.alpha);
  const path = frame.kit.paths[suit];
  if (path === undefined) {
    canvas.drawCircle(x + size / 2, y + size / 2, size / 2, paint);
    return;
  }
  canvas.save();
  canvas.translate(x, y);
  canvas.scale(size, size);
  canvas.drawPath(path, paint);
  canvas.restore();
}

/** A card: its face with an ink edge (Toybox: the edge keeps it 3:1 off the well), index and suit. */
export function drawCard(canvas: SkCanvas, frame: Frame, face: CardFace): void {
  const { kit, colors } = frame;
  const { rect } = face;
  const corner = rect.width * CORNER;
  canvas.drawRRect({ rect, rx: corner, ry: corner }, setFill(frame, colors.color.card, face.alpha));
  kit.stroke.setColor(colors.color.edge);
  kit.stroke.setAlphaf(face.alpha);
  kit.stroke.setStrokeWidth(Math.max(1, rect.width * EDGE));
  canvas.drawRRect({ rect, rx: corner, ry: corner }, kit.stroke);
  kit.stroke.setAlphaf(1);
  const font = kit.numberFont;
  if (font !== null) {
    const box = {
      x: rect.x + rect.width * RANK_BOX.side,
      y: rect.y + rect.height * RANK_BOX.top,
      width: rect.width * (1 - 2 * RANK_BOX.side),
      height: rect.height * RANK_BOX.height,
    };
    const paint = setFill(frame, colors.color.rank, face.alpha);
    drawScaledText(canvas, { text: rankText(face.card), box }, { font, paint });
  }
  drawSuit(canvas, frame, face);
  kit.fill.setAlphaf(1);
}
