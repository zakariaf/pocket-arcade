// apps/flock-tilt/src/board/draw-animals.ts
'worklet';

import { fxEntry } from '@e07/game-kit/timeline/sample.ts';
import { setPaintColor } from '@e07/shell/game-host/board-kit.ts';

import { sheepEntity, wolfEntity } from './board-ids.ts';
import { cellBox, drawUnitShape, indexBox, inset, isPlaying } from './draw-parts.ts';

import type { Frame, Grid } from './draw-parts.ts';
import type { SheepView, WolfView } from './to-view.ts';
import type { Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

/** How far a bump squashes an animal along the tilt, as a share of its size. */
const SQUASH = 0.22;
/** Ink edge of shapes, as a share of a cell. */
const EDGE = 0.045;
/** The fleece: puffs around the middle, as shares of a cell (round = sheep, never colour alone). */
const FLEECE: readonly (readonly [number, number])[] = [
  [0, -0.19],
  [0.18, -0.07],
  [0.13, 0.14],
  [-0.13, 0.14],
  [-0.18, -0.07],
  [0, 0],
];
/** The outline pass (grown by the edge width) and the fill pass. */
const FLEECE_PASSES: readonly (readonly ['edge' | 'sheep', number])[] = [
  ['edge', 1],
  ['sheep', 0],
];

/** Where an animal is drawn this frame: its slide's (col, row) while it moves, else its cell. */
function placeOf(frame: Frame, grid: Grid, at: { entity: number; cell: number }): Rect {
  const pos = fxEntry(frame.fx, 'pos', at.entity);
  if (pos === undefined) return indexBox(grid, frame, at.cell);
  return cellBox(grid, pos.values[0] ?? 0, pos.values[1] ?? 0);
}

/** Squashes the canvas around a rectangle's centre while the animal's bump plays. */
function squash(canvas: SkCanvas, frame: Frame, at: { entity: number; rect: Rect }): boolean {
  const bump = fxEntry(frame.fx, 'bump', at.entity);
  if (!isPlaying(bump)) return false;
  const [amount = 0, dx = 0, dy = 0] = bump.values;
  const along = amount * SQUASH;
  const cx = at.rect.x + at.rect.width / 2;
  const cy = at.rect.y + at.rect.height / 2;
  canvas.save();
  canvas.translate(cx, cy);
  canvas.scale(
    1 - along * Math.abs(dx) + along * 0.5 * Math.abs(dy),
    1 - along * Math.abs(dy) + along * 0.5 * Math.abs(dx),
  );
  canvas.translate(-cx, -cy);
  return true;
}

/** A round, fleecy sheep: a white body with an ink edge and a dark face (round = sheep). */
function drawSheepBody(canvas: SkCanvas, frame: Frame, rect: Rect): void {
  const { kit, colors } = frame;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const puff = rect.width * 0.15;
  const edge = Math.max(1, rect.width * EDGE);
  // Two passes over the fleece puffs: the ink outline first, then the white fill on top, so the
  // edge shows only around the whole fleece.
  for (const [color, grow] of FLEECE_PASSES) {
    kit.fill.setColor(colors.color[color]);
    for (const [dx, dy] of FLEECE) {
      canvas.drawCircle(cx + dx * rect.width, cy + dy * rect.width, puff + grow * edge, kit.fill);
    }
  }
  kit.fill.setColor(colors.color.sheepFace);
  canvas.drawOval(
    {
      x: cx - rect.width * 0.11,
      y: cy - rect.width * 0.08,
      width: rect.width * 0.22,
      height: rect.width * 0.27,
    },
    kit.fill,
  );
}

/** The ring on a sheep the wolf got, after its flash started (and the flash while it plays). */
function drawLostMarks(canvas: SkCanvas, frame: Frame, at: { entity: number; rect: Rect }): void {
  const { kit, colors } = frame;
  const lost = fxEntry(frame.fx, 'lost', at.entity);
  const cx = at.rect.x + at.rect.width / 2;
  const cy = at.rect.y + at.rect.height / 2;
  kit.stroke.setColor(colors.color.lost);
  kit.stroke.setStrokeWidth(Math.max(2, at.rect.width * 0.08));
  if (lost === undefined || lost.ageMs > 0) {
    canvas.drawCircle(cx, cy, at.rect.width * 0.44, kit.stroke);
  }
  if (isPlaying(lost)) {
    setPaintColor(kit.fill, colors.color.lost, (lost.values[0] ?? 0) * 0.5);
    canvas.drawCircle(cx, cy, at.rect.width * 0.5, kit.fill);
  }
}

/** The size a penned sheep still has while it drops in: 1 until its drop starts, 0 when done. */
function dropScale(frame: Frame, entity: number): number {
  const drop = fxEntry(frame.fx, 'drop', entity);
  if (drop === undefined || drop.ageMs <= 0) return 1;
  return drop.values[0] ?? 0;
}

function drawOneSheep(canvas: SkCanvas, frame: Frame, at: { grid: Grid; sheep: SheepView }): void {
  const entity = sheepEntity(at.sheep.id);
  const isPenned = at.sheep.status === 'penned';
  if (isPenned && fxEntry(frame.fx, 'pos', entity) === undefined) return;
  const scale = isPenned ? dropScale(frame, entity) : 1;
  if (scale <= 0) return;
  const place = placeOf(frame, at.grid, { entity, cell: at.sheep.cell });
  const rect = inset(place, (1 - scale) / 2);
  const isSquashed = squash(canvas, frame, { entity, rect });
  drawSheepBody(canvas, frame, rect);
  if (isSquashed) canvas.restore();
  if (at.sheep.status === 'lost') drawLostMarks(canvas, frame, { entity, rect });
}

/** Every sheep: on the field, lost, or (only while it slides and drops in) penned. */
export function drawSheep(canvas: SkCanvas, frame: Frame, grid: Grid): void {
  for (const sheep of frame.view.sheep) drawOneSheep(canvas, frame, { grid, sheep });
}

function drawOneWolf(canvas: SkCanvas, frame: Frame, at: { grid: Grid; wolf: WolfView }): void {
  const entity = wolfEntity(at.wolf.id);
  const rect = placeOf(frame, at.grid, { entity, cell: at.wolf.cell });
  const isSquashed = squash(canvas, frame, { entity, rect });
  const body = inset(rect, 0.1);
  drawUnitShape(canvas, frame, {
    path: frame.kit.paths['wolf'],
    rect: body,
    fill: 'wolf',
    edge: Math.max(1, rect.width * EDGE),
  });
  frame.kit.fill.setColor(frame.colors.color.wolfEye);
  canvas.drawCircle(
    rect.x + rect.width * 0.38,
    rect.y + rect.height * 0.46,
    rect.width * 0.05,
    frame.kit.fill,
  );
  canvas.drawCircle(
    rect.x + rect.width * 0.62,
    rect.y + rect.height * 0.46,
    rect.width * 0.05,
    frame.kit.fill,
  );
  if (isSquashed) canvas.restore();
}

/** Every wolf: an angular head with bright eyes (angular = wolf, never colour alone). */
export function drawWolves(canvas: SkCanvas, frame: Frame, grid: Grid): void {
  for (const wolf of frame.view.wolves) drawOneWolf(canvas, frame, { grid, wolf });
}

/** Every rock: a grey, edged boulder. */
export function drawRocks(canvas: SkCanvas, frame: Frame, grid: Grid): void {
  for (const rock of frame.view.rocks) {
    const rect = inset(indexBox(grid, frame, rock), 0.08);
    drawUnitShape(canvas, frame, {
      path: frame.kit.paths['rock'],
      rect,
      fill: 'rock',
      edge: Math.max(1, grid.cell * EDGE),
    });
  }
}
