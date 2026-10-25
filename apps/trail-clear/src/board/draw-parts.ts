// apps/trail-clear/src/board/draw-parts.ts
'worklet';

import { setPaintColor } from '@e07/shell/game-host/board-kit.ts';

import type { BoardToken } from './board-palettes.ts';
import type { TrailClearView } from './to-view.ts';
import type { BoardTarget, Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { DrawFrame } from '@e07/shell/game-host/board-types.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

/** The frame every Trail Clear draw function receives. */
export type Frame = DrawFrame<TrailClearView, BoardToken>;

const CORNER = 0.12;
/** Tiles sit this share of a cell inside it; their ink edge is this share of a cell wide. */
export const INSET = 0.04;
const EDGE = 0.04;
/** The ink edge stays between these widths in points, as the Toybox outlines do. */
const EDGE_PT = { min: 1.5, max: 3 } as const;
/**
 * A size tween below this draws nothing: an out-back track at its start rounds to a hair above 0
 * (1.70158 - 2.70158 is not exactly -1), which would draw a dot before the move plays.
 */
export const MIN_VISIBLE = 0.01;

export function inset(rect: Rect, share: number): Rect {
  const by = rect.width * share;
  return {
    x: rect.x + by,
    y: rect.y + by,
    width: rect.width - 2 * by,
    height: rect.height - 2 * by,
  };
}

/** The rect scaled about its centre (a pop, a shrink, a tray tile growing in). */
export function scaled(rect: Rect, scale: number): Rect {
  const width = rect.width * scale;
  const height = rect.height * scale;
  return {
    x: rect.x + (rect.width - width) / 2,
    y: rect.y + (rect.height - height) / 2,
    width,
    height,
  };
}

/** The tray slot a target names (the tray lies in one row or one column), or null. */
export function slotOf(target: BoardTarget | null): number | null {
  return target?.regionId === 'tray' ? target.col + target.row : null;
}

/**
 * A rounded face in `token`, edged in ink (Toybox: fills carry an outline). `alpha` fades fill and
 * edge together (setColor resets a paint's alpha, so it is set here).
 */
export function drawFace(
  canvas: SkCanvas,
  frame: Frame,
  face: { readonly rect: Rect; readonly token: BoardToken; readonly alpha?: number },
): void {
  const { rect } = face;
  const { fill, stroke } = frame.kit;
  const alpha = face.alpha ?? 1;
  const r = rect.width * CORNER;
  setPaintColor(fill, frame.colors.color[face.token], alpha);
  canvas.drawRRect({ rect, rx: r, ry: r }, fill);
  setPaintColor(stroke, frame.colors.color.edge, alpha);
  stroke.setStrokeWidth(Math.min(EDGE_PT.max, Math.max(EDGE_PT.min, rect.width * EDGE)));
  canvas.drawRRect({ rect, rx: r, ry: r }, stroke);
}

/** A ring in `token` around a cell or a tray slot (selection, hints, what a placement wipes). */
export function drawRing(
  canvas: SkCanvas,
  frame: Frame,
  ring: { readonly rect: Rect; readonly width: number; readonly token: BoardToken },
): void {
  const { rect } = ring;
  const r = rect.width * CORNER;
  frame.kit.stroke.setColor(frame.colors.color[ring.token]);
  frame.kit.stroke.setStrokeWidth(ring.width);
  canvas.drawRRect({ rect, rx: r, ry: r }, frame.kit.stroke);
}
