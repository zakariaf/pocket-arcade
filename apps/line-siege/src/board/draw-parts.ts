// apps/line-siege/src/board/draw-parts.ts
'worklet';

import type { BoardToken } from './board-palettes.ts';
import type { LineSiegeView } from './to-view.ts';
import type { Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { FxEntry } from '@e07/game-kit/timeline/sample.ts';
import type { DrawFrame } from '@e07/shell/game-host/board-types.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

/** The frame every Line Siege draw function receives. */
export type Frame = DrawFrame<LineSiegeView, BoardToken>;

const CORNER = 0.14;
/** Blocks sit this share of a cell inside it; their ink edge is this share of a cell wide. */
export const INSET = 0.06;
const EDGE = 0.05;

export function inset(rect: Rect, share: number): Rect {
  const by = rect.width * share;
  return {
    x: rect.x + by,
    y: rect.y + by,
    width: rect.width - 2 * by,
    height: rect.height - 2 * by,
  };
}

/**
 * An effect that is not a tween of something already visible (a flash, a wave, a burst) draws only
 * once its track has started: before that, a sample holds the track's `from` values, and drawing it
 * would show the effect at full strength at moment 0.
 */
export function isPlaying(entry: FxEntry | undefined): entry is FxEntry {
  return entry !== undefined && entry.ageMs > 0 && entry.progress < 1;
}

/**
 * A rounded block in the current fill colour, edged in the wall ink (Toybox: fills carry an
 * outline). `alpha` fades fill and edge together (setColor resets a paint's alpha, so it is set here).
 */
export function drawBlock(
  canvas: SkCanvas,
  frame: Frame,
  block: { readonly rect: Rect; readonly alpha?: number },
): void {
  const { rect } = block;
  const { fill, stroke } = frame.kit;
  const alpha = block.alpha ?? 1;
  const r = rect.width * CORNER;
  fill.setAlphaf(alpha);
  canvas.drawRRect({ rect, rx: r, ry: r }, fill);
  stroke.setColor(frame.colors.color.wall);
  stroke.setAlphaf(alpha);
  stroke.setStrokeWidth(Math.max(1, rect.width * EDGE));
  canvas.drawRRect({ rect, rx: r, ry: r }, stroke);
  fill.setAlphaf(1);
  stroke.setAlphaf(1);
}

/** A ring in the wall ink around a cell or a tray slot (selection and hints). */
export function drawRing(
  canvas: SkCanvas,
  frame: Frame,
  ring: { readonly rect: Rect; readonly width: number },
): void {
  const { rect } = ring;
  const r = rect.width * CORNER;
  frame.kit.stroke.setColor(frame.colors.color.wall);
  frame.kit.stroke.setStrokeWidth(ring.width);
  canvas.drawRRect({ rect, rx: r, ry: r }, frame.kit.stroke);
}

/** A tray block as flat [dx, dy, ...] offsets from its anchor cell `at` (one cell's rect). */
export function drawPiece(
  canvas: SkCanvas,
  frame: Frame,
  piece: { readonly offsets: readonly number[]; readonly at: Rect },
): void {
  const { offsets, at } = piece;
  for (let i = 0; i + 1 < offsets.length; i += 2) {
    const x = at.x + (offsets[i] ?? 0) * at.width;
    const y = at.y + (offsets[i + 1] ?? 0) * at.width;
    drawBlock(canvas, frame, { rect: inset({ x, y, width: at.width, height: at.width }, INSET) });
  }
}
