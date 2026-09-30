// packages/shell/src/game-host/draw-centered-text.ts
'worklet';

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

/** Draws already-localised digits (e.g. "۱۲") centred on cx. No shaping: digits and Latin only. */
export function drawCenteredText(
  canvas: SkCanvas,
  label: CenteredText,
  style: { readonly font: SkFont; readonly paint: SkPaint },
): void {
  canvas.drawText(
    label.text,
    label.cx - textWidth(style.font, label.text) / 2,
    label.y,
    style.paint,
    style.font,
  );
}
