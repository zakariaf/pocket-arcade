// packages/shell/src/game-host/draw-centered-text.ts
'worklet';

import type { Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { SkCanvas, SkFont, SkPaint } from '@shopify/react-native-skia';

/**
 * Width of a run of digits/Latin text. Uses glyph widths because SkFont.measureText is not
 * implemented in Skia's CanvasKit build (returns a jest.fn in Jest, throws in Node headless).
 */
export function textWidth(font: SkFont, text: string): number {
  let width = 0;
  for (const glyphWidth of font.getGlyphWidths(font.getGlyphIDs(text))) width += glyphWidth;
  return width;
}

export type CenteredText = {
  readonly text: string;
  readonly cx: number;
  /** Baseline y. */
  readonly y: number;
};

export type TextStyle = { readonly font: SkFont; readonly paint: SkPaint };

/** Draws already-localised digits (e.g. "۱۲") centred on cx. No shaping: digits and Latin only. */
export function drawCenteredText(canvas: SkCanvas, label: CenteredText, style: TextStyle): void {
  canvas.drawText(
    label.text,
    label.cx - textWidth(style.font, label.text) / 2,
    label.y,
    style.paint,
    style.font,
  );
}

export type FittedText = {
  readonly text: string;
  /** The shape the text must fit (a monster, a small cell): the text is centred in it. */
  readonly rect: Rect;
  /** Largest share of the rect's width and height the text may fill (default 0.8). */
  readonly maxShare?: number;
};

/** Digits sit about this share of the font size above their baseline's centre line. */
const DIGIT_CENTRE = 0.36;

/** The scale (at most 1) that fits a measured width and a font size into maxShare of the rect. */
function scaleToFit(width: number, size: number, label: FittedText): number {
  const share = label.maxShare ?? 0.8;
  const byWidth = width > 0 ? (label.rect.width * share) / width : 1;
  const byHeight = size > 0 ? (label.rect.height * share) / size : 1;
  return Math.max(0, Math.min(1, byWidth, byHeight));
}

/**
 * The scale (at most 1) that fits the text's measured glyph width and the font's size into
 * maxShare of the rect. Pure, so it is tested without Skia.
 */
export function fittedScale(font: SkFont, label: FittedText): number {
  return scaleToFit(textWidth(font, label.text), font.getSize(), label);
}

/**
 * Draws digits centred in a small shape, shrunk (never grown) so they fill at most maxShare of its
 * width and height: the kit has one number size, and a half-cell monster is smaller than it. The
 * text is measured once, for the scale and for the centring.
 */
export function drawFittedText(canvas: SkCanvas, label: FittedText, style: TextStyle): void {
  const width = textWidth(style.font, label.text);
  const size = style.font.getSize();
  const scale = scaleToFit(width, size, label);
  if (scale <= 0) return;
  const { rect } = label;
  canvas.save();
  canvas.translate(rect.x + rect.width / 2, rect.y + rect.height / 2 + size * scale * DIGIT_CENTRE);
  canvas.scale(scale, scale);
  canvas.drawText(label.text, 0 - width / 2, 0, style.paint, style.font);
  canvas.restore();
}
