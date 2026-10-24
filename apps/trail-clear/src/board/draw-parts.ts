// apps/trail-clear/src/board/draw-parts.ts
'worklet';

import type { BoardToken } from './board-palettes.ts';
import type { TrailClearView } from './to-view.ts';
import type { BoardTarget, Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { FxEntry } from '@e07/game-kit/timeline/sample.ts';
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

/**
 * An effect that is not a tween of something already visible (a ring, a burst) draws only once its
 * track has started: before that, a sample holds the track's `from` values, and drawing it would
 * show the effect at full strength at moment 0.
 */
export function isPlaying(entry: FxEntry | undefined): entry is FxEntry {
  return entry !== undefined && entry.ageMs > 0 && entry.progress < 1;
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
  fill.setColor(frame.colors.color[face.token]);
  fill.setAlphaf(alpha);
  canvas.drawRRect({ rect, rx: r, ry: r }, fill);
  stroke.setColor(frame.colors.color.edge);
  stroke.setAlphaf(alpha);
  stroke.setStrokeWidth(Math.min(EDGE_PT.max, Math.max(EDGE_PT.min, rect.width * EDGE)));
  canvas.drawRRect({ rect, rx: r, ry: r }, stroke);
  fill.setAlphaf(1);
  stroke.setAlphaf(1);
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
