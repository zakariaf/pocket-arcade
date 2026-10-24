// apps/trail-clear/src/board/draw-tile.ts
'worklet';
// One tile: a grass face edged in ink, then its river and its road drawn as unit paths over it (the
// road on top, so a bridge carries the road over the river). A road end has a house, a river end a
// pond; the road carries centre dashes and the river runs wider, so the two never differ by colour
// alone (spec 8.11).

import { drawFace, inset, INSET } from './draw-parts.ts';
import { capCentre, partPath, trailParts } from './tile-parts.ts';

import type { Frame } from './draw-parts.ts';
import type { TrailPart } from './tile-parts.ts';
import type { Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { SkCanvas, SkPaint } from '@shopify/react-native-skia';

const ROAD = 1;
const RIVER = 2;
const DASHES = 0;
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

type Layer = {
  readonly parts: readonly TrailPart[];
  /** The terrain whose paths to draw (DASHES for the road's centre line). */
  readonly terrain: number;
  readonly paint: SkPaint;
};

/** The stub of a terrain that has a single edge (it ends at a house or a pond), or null. */
function endOf(parts: readonly TrailPart[]): TrailPart | null {
  const [only] = parts;
  return parts.length === 1 && only?.shape === 'stub' ? only : null;
}

/** Each part's unit path of the layer (a missing path is skipped). */
function drawLayer(canvas: SkCanvas, frame: Frame, layer: Layer): void {
  for (const part of layer.parts) {
    const path = frame.kit.paths[partPath(layer.terrain, part)];
    if (path !== undefined) canvas.drawPath(path, layer.paint);
  }
}

/** The river: its bands, and a pond where it ends. */
function drawRiver(canvas: SkCanvas, frame: Frame, look: TileLook): void {
  const { fill } = frame.kit;
  const parts = trailParts(look.edges, RIVER);
  fill.setColor(frame.colors.color.river);
  fill.setAlphaf(look.alpha ?? 1);
  drawLayer(canvas, frame, { parts, terrain: RIVER, paint: fill });
  const end = endOf(parts);
  if (end !== null) {
    const cap = capCentre(end.turn);
    canvas.drawCircle(cap.x, cap.y, POND_RADIUS, fill);
  }
  fill.setAlphaf(1);
}

/** The road: its bands, its centre dashes, and a house where it ends. */
function drawRoad(canvas: SkCanvas, frame: Frame, look: TileLook): void {
  const { fill, stroke, paths } = frame.kit;
  const { color } = frame.colors;
  const alpha = look.alpha ?? 1;
  const parts = trailParts(look.edges, ROAD);
  fill.setColor(color.road);
  fill.setAlphaf(alpha);
  drawLayer(canvas, frame, { parts, terrain: ROAD, paint: fill });
  stroke.setColor(color.line);
  stroke.setAlphaf(alpha);
  stroke.setStrokeWidth(DASH_WIDTH);
  drawLayer(canvas, frame, { parts, terrain: DASHES, paint: stroke });
  stroke.setAlphaf(1);
  const end = endOf(parts);
  const home = end === null ? undefined : paths[`house-${String(end.turn)}`];
  if (home !== undefined) {
    fill.setColor(color.house);
    fill.setAlphaf(alpha);
    canvas.drawPath(home, fill);
  }
  fill.setAlphaf(1);
}

/** Pure worklet: the tile on its cell, faded by `alpha`. */
export function drawTile(canvas: SkCanvas, frame: Frame, look: TileLook): void {
  const face = inset(look.rect, INSET);
  drawFace(canvas, frame, { rect: face, token: 'grass', alpha: look.alpha ?? 1 });
  canvas.save();
  canvas.translate(face.x, face.y);
  canvas.scale(face.width, face.width);
  drawRiver(canvas, frame, look);
  drawRoad(canvas, frame, look);
  canvas.restore();
}
