// apps/flock-tilt/src/board/draw-parts.ts
'worklet';

import { cellRect } from '@e07/game-kit/geom/board-layout.ts';

import { FIELD_REGION } from './board-ids.ts';

import type { BoardToken } from './board-palettes.ts';
import type { FlockTiltView } from './to-view.ts';
import type { Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { FxEntry } from '@e07/game-kit/timeline/sample.ts';
import type { DrawFrame } from '@e07/shell/game-host/board-types.ts';
import type { SkCanvas, SkPath } from '@shopify/react-native-skia';

export type Frame = DrawFrame<FlockTiltView, BoardToken>;

/** The field's top-left corner and cell size in canvas points. */
export type Grid = { readonly x: number; readonly y: number; readonly cell: number };

/** A unit-size (0..1) path drawn into a rectangle with a fill and an ink edge. */
export type UnitShape = {
  readonly path: SkPath | undefined;
  readonly rect: Rect;
  readonly fill: BoardToken;
  /** Edge width in canvas points. */
  readonly edge: number;
};

/** The field's grid, or null before the canvas has a size. */
export function fieldGrid(frame: Frame): Grid | null {
  const first = cellRect(frame.layout, { regionId: FIELD_REGION, col: 0, row: 0 });
  return first === null ? null : { x: first.x, y: first.y, cell: first.width };
}

/** A cell (fractional while sliding) as a canvas rectangle. */
export function cellBox(grid: Grid, col: number, row: number): Rect {
  return {
    x: grid.x + col * grid.cell,
    y: grid.y + row * grid.cell,
    width: grid.cell,
    height: grid.cell,
  };
}

/** A field cell index as a canvas rectangle. */
export function indexBox(grid: Grid, frame: Frame, index: number): Rect {
  return cellBox(grid, index % frame.view.cols, Math.floor(index / frame.view.cols));
}

export function inset(rect: Rect, share: number): Rect {
  const by = rect.width * share;
  return {
    x: rect.x + by,
    y: rect.y + by,
    width: rect.width - 2 * by,
    height: rect.height - 2 * by,
  };
}

/** An effect that is not a tween of something visible draws only while its track plays. */
export function isPlaying(entry: FxEntry | undefined): entry is FxEntry {
  return entry !== undefined && entry.ageMs > 0 && entry.progress < 1;
}

/** Draws a unit path scaled into its rectangle: fill, then the ink edge (a circle without it). */
export function drawUnitShape(canvas: SkCanvas, frame: Frame, shape: UnitShape): void {
  const { kit, colors } = frame;
  const { rect, path } = shape;
  kit.fill.setColor(colors.color[shape.fill]);
  kit.stroke.setColor(colors.color.edge);
  if (path === undefined) {
    const radius = rect.width / 2;
    canvas.drawCircle(rect.x + radius, rect.y + radius, radius, kit.fill);
    return;
  }
  canvas.save();
  canvas.translate(rect.x, rect.y);
  canvas.scale(rect.width, rect.height);
  kit.stroke.setStrokeWidth(shape.edge / rect.width);
  canvas.drawPath(path, kit.fill);
  canvas.drawPath(path, kit.stroke);
  canvas.restore();
}
