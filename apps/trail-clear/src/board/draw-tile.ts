// apps/trail-clear/src/board/draw-tile.ts
'worklet';
// One tile: a grass face edged in ink, then its river and its road drawn as unit paths over it (the
// road on top, so a bridge carries the road over the river). A road end has a house, a river end a
// pond; the road carries centre dashes and the river runs wider, so the two never differ by colour
// alone (spec 8.11).

import { setPaintColor } from '@e07/shell/game-host/board-kit.ts';

import { drawFace, inset, INSET } from './draw-parts.ts';
import { tileLayers } from './tile-parts.ts';

import type { Frame } from './draw-parts.ts';
import type { TileLayers } from './tile-parts.ts';
import type { Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { SkCanvas, SkPaint } from '@shopify/react-native-skia';

/** Width of the road's centre dashes, as a share of the tile (the paths are unit size). */
const DASH_WIDTH = 0.035;
const POND_RADIUS = 0.14;

export type TileLook = {
  /** Edges north, east, south, west (0 grass, 1 road, 2 river). */
  readonly edges: readonly number[];
  /** The cell (or tray tile) the tile fills; it is drawn INSET inside it. */
  readonly rect: Rect;
  readonly alpha?: number;
};

/** A tile's layers (looked up once per tile) and how faded it is. */
type Tile = { readonly layers: TileLayers; readonly alpha: number };

/** One layer's unit paths, by the kit's names, and the paint they fill or stroke. */
type Layer = { readonly names: readonly string[]; readonly paint: SkPaint };

/** Each unit path of the layer (a missing path is skipped). */
function drawLayer(canvas: SkCanvas, frame: Frame, layer: Layer): void {
  for (const name of layer.names) {
    const path = frame.kit.paths[name];
    if (path !== undefined) canvas.drawPath(path, layer.paint);
  }
}

/** The river: its bands, and a pond where it ends. */
function drawRiver(canvas: SkCanvas, frame: Frame, tile: Tile): void {
  const { fill } = frame.kit;
  const { pond } = tile.layers;
  setPaintColor(fill, frame.colors.color.river, tile.alpha);
  drawLayer(canvas, frame, { names: tile.layers.river, paint: fill });
  if (pond !== null) canvas.drawCircle(pond.x, pond.y, POND_RADIUS, fill);
}

/** The road: its bands, its centre dashes, and a house where it ends. */
function drawRoad(canvas: SkCanvas, frame: Frame, tile: Tile): void {
  const { fill, stroke, paths } = frame.kit;
  const { color } = frame.colors;
  const { layers, alpha } = tile;
  setPaintColor(fill, color.road, alpha);
  drawLayer(canvas, frame, { names: layers.road, paint: fill });
  setPaintColor(stroke, color.line, alpha);
  stroke.setStrokeWidth(DASH_WIDTH);
  drawLayer(canvas, frame, { names: layers.dashes, paint: stroke });
  const home = layers.house === null ? undefined : paths[layers.house];
  if (home !== undefined) {
    setPaintColor(fill, color.house, alpha);
    canvas.drawPath(home, fill);
  }
}

/** Pure worklet: the tile on its cell, faded by `alpha`. */
export function drawTile(canvas: SkCanvas, frame: Frame, look: TileLook): void {
  const face = inset(look.rect, INSET);
  const tile = { layers: tileLayers(look.edges), alpha: look.alpha ?? 1 };
  drawFace(canvas, frame, { rect: face, token: 'grass', alpha: tile.alpha });
  canvas.save();
  canvas.translate(face.x, face.y);
  canvas.scale(face.width, face.width);
  drawRiver(canvas, frame, tile);
  drawRoad(canvas, frame, tile);
  canvas.restore();
}
