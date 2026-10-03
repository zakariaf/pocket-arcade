// packages/shell/src/art/draw-logo.ts
// Imperative Skia drawing of a Toybox logo tile. It takes the Skia API as a parameter and imports
// only types, so the same code runs in the app, in CanvasKit goldens and in Node art scripts.
import { LOGO_GRID } from './logo-art.ts';

import type { LogoOp, LogoRotation } from './logo-art.ts';
import type { SkCanvas, SkRRect, Skia } from '@shopify/react-native-skia';

/** The Skia API object (native, CanvasKit in goldens, or headless in Node scripts). */
export type SkiaApi = typeof Skia;

// Numeric values of Skia's PaintStyle, StrokeCap and StrokeJoin enums (types-only import).
const STYLE_FILL = 0;
const STYLE_STROKE = 1;
const CAP_BUTT = 0;
const CAP_ROUND = 1;
const JOIN_ROUND = 1;

/** Logo tile geometry shared by every size: radius 0.24 x size, art at 88 % of the content box. */
export const LOGO_TILE = { radiusRatio: 0.24, artScale: 0.88 } as const;

export type LogoTileSpec = {
  /** Tile edge length in canvas units (px in scripts, pt in the app). */
  readonly size: number;
  /** Face paint: the game's accent (colors.primary). */
  readonly fill: string;
  /** Edge paint: colors.border, or toy ink on "cut" tiles. */
  readonly edge: string;
  readonly edgeWidth: number;
  /** White die-cut ring width; 0 for none. */
  readonly ring: number;
  readonly ringColor: string;
  readonly rotateDeg: number;
};

function rotateAbout(canvas: SkCanvas, rotation: LogoRotation): void {
  canvas.translate(rotation.cx, rotation.cy);
  canvas.rotate(rotation.deg, 0, 0);
  canvas.translate(-rotation.cx, -rotation.cy);
}

/** Draws the logo art into a size x size square at the canvas origin. */
export function drawLogoArt(
  skia: SkiaApi,
  canvas: SkCanvas,
  art: { readonly ops: readonly LogoOp[]; readonly size: number },
): void {
  canvas.save();
  canvas.scale(art.size / LOGO_GRID, art.size / LOGO_GRID);
  for (const op of art.ops) {
    const path = skia.Path.MakeFromSVGString(op.d);
    if (path === null) throw new Error(`Bad logo path: ${op.d}`);
    const paint = skia.Paint();
    paint.setAntiAlias(true);
    paint.setColor(skia.Color(op.color));
    paint.setStyle(op.style === 'fill' ? STYLE_FILL : STYLE_STROKE);
    paint.setStrokeWidth(op.width);
    paint.setStrokeCap(op.cap === 'round' ? CAP_ROUND : CAP_BUTT);
    paint.setStrokeJoin(JOIN_ROUND);
    canvas.save();
    if (op.rotate !== undefined) rotateAbout(canvas, op.rotate);
    canvas.drawPath(path, paint);
    canvas.restore();
  }
  canvas.restore();
}

function roundedSquare(skia: SkiaApi, inset: number, spec: LogoTileSpec): SkRRect {
  const side = spec.size - inset * 2;
  const radius = Math.max(0, spec.size * LOGO_TILE.radiusRatio - inset);
  return skia.RRectXY(skia.XYWHRect(inset, inset, side, side), radius, radius);
}

/** Draws a whole logo tile (ring, face, edge, art) centred on the canvas point (cx, cy). */
export function drawLogoTile(
  skia: SkiaApi,
  canvas: SkCanvas,
  tile: {
    readonly ops: readonly LogoOp[];
    readonly spec: LogoTileSpec;
    readonly cx: number;
    readonly cy: number;
  },
): void {
  const { spec } = tile;
  const paint = skia.Paint();
  paint.setAntiAlias(true);
  canvas.save();
  canvas.translate(tile.cx, tile.cy);
  canvas.rotate(spec.rotateDeg, 0, 0);
  canvas.translate(-spec.size / 2, -spec.size / 2);
  if (spec.ring > 0) {
    paint.setColor(skia.Color(spec.ringColor));
    canvas.drawRRect(roundedSquare(skia, -spec.ring, spec), paint);
  }
  paint.setColor(skia.Color(spec.fill));
  canvas.drawRRect(roundedSquare(skia, 0, spec), paint);
  paint.setColor(skia.Color(spec.edge));
  paint.setStyle(STYLE_STROKE);
  paint.setStrokeWidth(spec.edgeWidth);
  canvas.drawRRect(roundedSquare(skia, spec.edgeWidth / 2, spec), paint);
  // CSS border-box: the art is 88 % of the content box (inside the edge), centred.
  const content = spec.size - spec.edgeWidth * 2;
  const artSize = content * LOGO_TILE.artScale;
  canvas.translate((spec.size - artSize) / 2, (spec.size - artSize) / 2);
  drawLogoArt(skia, canvas, { ops: tile.ops, size: artSize });
  canvas.restore();
}
