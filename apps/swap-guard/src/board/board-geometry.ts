// apps/swap-guard/src/board/board-geometry.ts
'worklet';

import { cellRect } from '@e07/game-kit/geom/board-layout.ts';
import { pickAt } from '@e07/game-kit/rng/pick-at.ts';

import type { BoardLayout, Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { FxEntry } from '@e07/game-kit/timeline/sample.ts';
import type { Facing } from '@e07/swap-guard/rules/swap-guard-types.ts';
import type { SkCanvas, SkPaint, SkPath } from '@shopify/react-native-skia';

/** The rect of a board square by its row-major index. */
export function rectAt(layout: BoardLayout, size: number, cell: number): Rect | null {
  return cellRect(layout, { regionId: 'board', col: cell % size, row: Math.floor(cell / size) });
}

/** The rect between two squares at progress t: a slide's values [from, to, t]. */
export function rectBetween(
  layout: BoardLayout,
  size: number,
  slide: readonly number[],
): Rect | null {
  const from = rectAt(layout, size, pickAt(slide, 0));
  const to = rectAt(layout, size, pickAt(slide, 1));
  if (from === null || to === null) return null;
  const t = pickAt(slide, 2);
  return { ...to, x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

/** A rect shrunk by a share of its width on every side. */
export function inset(rect: Rect, share: number): Rect {
  const by = rect.width * share;
  return {
    x: rect.x + by,
    y: rect.y + by,
    width: rect.width - 2 * by,
    height: rect.height - 2 * by,
  };
}

/** A rect scaled about its centre (1 = unchanged). */
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

/** An effect that is not a tween of something visible draws only once its track has started. */
export function isPlaying(entry: FxEntry | undefined): entry is FxEntry {
  return entry !== undefined && entry.ageMs > 0 && entry.progress < 1;
}

/** Degrees that turn a shape drawn pointing up toward a facing (physical: never mirrored). */
export function degreesOf(facing: Facing): number {
  if (facing === 'right') return 90;
  if (facing === 'down') return 180;
  return facing === 'left' ? 270 : 0;
}

/** One square's step toward a facing, in board units (y grows downward). */
export function stepOf(facing: Facing): { readonly x: number; readonly y: number } {
  if (facing === 'right') return { x: 1, y: 0 };
  if (facing === 'down') return { x: 0, y: 1 };
  return facing === 'left' ? { x: -1, y: 0 } : { x: 0, y: -1 };
}

/** One unit-size (0..1) path placed in a rect and turned about its centre. */
export type UnitShape = {
  readonly path: SkPath;
  readonly rect: Rect;
  readonly degrees: number;
  readonly paint: SkPaint;
};

/** Draws a unit path in its rect; a stroke paint's width must already be in unit space. */
export function drawUnitPath(canvas: SkCanvas, shape: UnitShape): void {
  const { rect } = shape;
  canvas.save();
  canvas.rotate(shape.degrees, rect.x + rect.width / 2, rect.y + rect.height / 2);
  canvas.translate(rect.x, rect.y);
  canvas.scale(rect.width, rect.height);
  canvas.drawPath(shape.path, shape.paint);
  canvas.restore();
}
