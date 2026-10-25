// apps/scrap-shove/src/board/board-geometry.ts
'worklet';

import { cellRect } from '@e07/game-kit/geom/board-layout.ts';

import type { BoardToken } from './board-palettes.ts';
import type { ScrapShoveView } from './to-view.ts';
import type { BoardLayout, Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { FxEntry } from '@e07/game-kit/timeline/sample.ts';
import type { DrawFrame } from '@e07/shell/game-host/board-types.ts';
import type { SkCanvas, SkPath } from '@shopify/react-native-skia';

export type Frame = DrawFrame<ScrapShoveView, BoardToken>;

/** The square at a (possibly fractional, mid-slide) column and row, or null before layout. */
export function squareAt(layout: BoardLayout, col: number, row: number): Rect | null {
  return cellRect(layout, { regionId: 'board', col, row });
}

/** A rectangle shrunk by a share of its width on every side. */
export function inset(rect: Rect, share: number): Rect {
  const by = rect.width * share;
  return {
    x: rect.x + by,
    y: rect.y + by,
    width: rect.width - 2 * by,
    height: rect.height - 2 * by,
  };
}

/** A square of `share` of the rectangle's width, centred in it. */
export function centred(rect: Rect, share: number): Rect {
  return inset(rect, (1 - share) / 2);
}

/**
 * The square a piece is drawn on: where its [col, row, ...] track has it (mid-slide squares are
 * fractional), or `rest` (the view's square, or the square a vanished piece broke on) without one.
 */
export function trackedSquare(frame: Frame, key: string, rest: readonly number[]): Rect | null {
  const values = frame.fx.entries[key]?.values ?? rest;
  return squareAt(frame.layout, values[0] ?? 0, values[1] ?? 0);
}

/** An effect that is not a tween of something visible draws only once its track has started. */
export function isPlaying(entry: FxEntry | undefined): entry is FxEntry {
  return entry !== undefined && entry.ageMs > 0 && entry.progress < 1;
}

/** The whole floor's rectangle, or null before the canvas has a size. */
export function floorRect(frame: Frame): Rect | null {
  const { cols, rows } = frame.view;
  const first = squareAt(frame.layout, 0, 0);
  const last = squareAt(frame.layout, cols - 1, rows - 1);
  if (first === null || last === null) return null;
  return {
    x: first.x,
    y: first.y,
    width: last.x + last.width - first.x,
    height: last.y + last.height - first.y,
  };
}

/** A unit-size (0…1) path and the rectangle it is stretched over. */
export type UnitShape = { readonly path: SkPath; readonly rect: Rect };

/** Fills a unit path over a rectangle with the kit's fill paint (set its colour first). */
export function drawUnitPath(canvas: SkCanvas, frame: Frame, shape: UnitShape): void {
  canvas.save();
  canvas.translate(shape.rect.x, shape.rect.y);
  canvas.scale(shape.rect.width, shape.rect.height);
  canvas.drawPath(shape.path, frame.kit.fill);
  canvas.restore();
}
