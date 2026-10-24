// apps/flock-tilt/src/board/draw-board.ts
'worklet';

import { cellRect } from '@e07/game-kit/geom/board-layout.ts';
import { sampleParticle } from '@e07/game-kit/timeline/particles.ts';
import { fxEntry } from '@e07/game-kit/timeline/sample.ts';
import { setPaintColor } from '@e07/shell/game-host/board-kit.ts';
import { drawFittedText } from '@e07/shell/game-host/draw-centered-text.ts';

import { FENCE_SHARE, sheepEntity, TILT_KEY_REGIONS, TURN_ENTITY } from './board-ids.ts';
import { drawRocks, drawSheep, drawWolves } from './draw-animals.ts';
import { cellBox, fieldGrid, indexBox, inset, isPlaying } from './draw-parts.ts';

import type { Frame, Grid } from './draw-parts.ts';
import type { Direction } from '@e07/flock-tilt/rules/flock-tilt-types.ts';
import type { Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

const CORNER = 0.18;
const BURST_COUNT = 14;
/** The arrow keys' rotation, in degrees, from the unit arrow that points up. */
const KEY_TURN: readonly (readonly [Direction, number])[] = [
  ['up', 0],
  ['right', 90],
  ['down', 180],
  ['left', 270],
];

function fieldRect(frame: Frame, grid: Grid): Rect {
  const { cols, rows } = frame.view;
  return { x: grid.x, y: grid.y, width: cols * grid.cell, height: rows * grid.cell };
}

/** The fence, then the grass in a soft check (the field is a physical space: it never mirrors). */
function drawField(canvas: SkCanvas, frame: Frame, grid: Grid): void {
  const { kit, colors } = frame;
  const field = fieldRect(frame, grid);
  const by = Math.ceil(grid.cell * FENCE_SHARE);
  const fence = {
    x: field.x - by,
    y: field.y - by,
    width: field.width + 2 * by,
    height: field.height + 2 * by,
  };
  const corner = grid.cell * CORNER;
  kit.fill.setColor(colors.color.fence);
  canvas.drawRRect({ rect: fence, rx: corner, ry: corner }, kit.fill);
  kit.stroke.setColor(colors.color.edge);
  kit.stroke.setStrokeWidth(Math.max(1.5, grid.cell * 0.05));
  canvas.drawRRect({ rect: fence, rx: corner, ry: corner }, kit.stroke);
  kit.fill.setColor(colors.color.grass);
  canvas.drawRect(field, kit.fill);
  kit.fill.setColor(colors.color.grassAlt);
  for (let index = 0; index < frame.view.cols * frame.view.rows; index += 1) {
    const col = index % frame.view.cols;
    const row = Math.floor(index / frame.view.cols);
    if ((col + row) % 2 === 1) canvas.drawRect(cellBox(grid, col, row), kit.fill);
  }
}

/** The pen: a straw square with an ink edge and the number of sheep already in it. */
function drawPen(canvas: SkCanvas, frame: Frame, grid: Grid): void {
  const { kit, colors, view } = frame;
  const rect = inset(indexBox(grid, frame, view.pen), 0.06);
  kit.fill.setColor(colors.color.pen);
  canvas.drawRect(rect, kit.fill);
  kit.stroke.setColor(colors.color.edge);
  kit.stroke.setStrokeWidth(Math.max(1.5, grid.cell * 0.06));
  canvas.drawRect(rect, kit.stroke);
  const font = kit.numberFont;
  if (font === null) return;
  kit.fill.setColor(colors.color.label);
  drawFittedText(canvas, { text: view.pennedText, rect, maxShare: 0.6 }, { font, paint: kit.fill });
}

/** A burst of straw and fleece from the pen when a sheep drops in (full motion only). */
function drawBursts(canvas: SkCanvas, frame: Frame, grid: Grid): void {
  const pen = indexBox(grid, frame, frame.view.pen);
  for (const sheep of frame.view.sheep) {
    const burst = fxEntry(frame.fx, 'burst', sheepEntity(sheep.id));
    if (!isPlaying(burst)) continue;
    const spec = {
      seed: sheep.id * 31 + frame.view.pen,
      x: pen.x + pen.width / 2,
      y: pen.y + pen.height / 2,
      count: BURST_COUNT,
      minSpeed: grid.cell * 1.5,
      maxSpeed: grid.cell * 4,
      gravity: grid.cell * 6,
      lifeMs: 600,
    };
    for (let i = 0; i < spec.count; i += 1) {
      const particle = sampleParticle(spec, i, burst.ageMs);
      setPaintColor(frame.kit.fill, frame.colors.color.glow, particle.alpha);
      canvas.drawCircle(particle.x, particle.y, grid.cell * 0.06, frame.kit.fill);
    }
  }
}

/** Whole-field washes: the glow of a cleared field, the dimming when the tilts ran out, the rewind. */
function drawWashes(canvas: SkCanvas, frame: Frame, grid: Grid): void {
  const field = fieldRect(frame, grid);
  const washes: readonly (readonly [string, 'glow' | 'background', number])[] = [
    ['glow', 'glow', 0.55],
    ['tired', 'background', 0.5],
    ['rewind', 'glow', 0.35],
  ];
  for (const [channel, token, strength] of washes) {
    const entry = fxEntry(frame.fx, channel, TURN_ENTITY);
    if (!isPlaying(entry)) continue;
    setPaintColor(frame.kit.fill, frame.colors.color[token], (entry.values[0] ?? 0) * strength);
    canvas.drawRect(field, frame.kit.fill);
  }
}

/** One tilt key: a raised square with an ink edge and its arrow; the hinted key gets a ring. */
function drawKey(canvas: SkCanvas, frame: Frame, at: { direction: Direction; turn: number }): void {
  const { kit, colors } = frame;
  const regionId = TILT_KEY_REGIONS[at.direction];
  const cell = cellRect(frame.layout, { regionId, col: 0, row: 0 });
  if (cell === null) return;
  const rect = inset(cell, 0.1);
  const corner = rect.width * CORNER;
  kit.fill.setColor(colors.color.key);
  canvas.drawRRect({ rect, rx: corner, ry: corner }, kit.fill);
  kit.stroke.setColor(colors.color.edge);
  kit.stroke.setStrokeWidth(Math.max(1.5, rect.width * 0.05));
  canvas.drawRRect({ rect, rx: corner, ry: corner }, kit.stroke);
  const arrow = kit.paths['arrow'];
  if (arrow !== undefined) {
    const size = rect.width * 0.5;
    canvas.save();
    canvas.translate(rect.x + rect.width / 2, rect.y + rect.height / 2);
    canvas.rotate(at.turn, 0, 0);
    canvas.translate(-size / 2, -size / 2);
    canvas.scale(size, size);
    kit.fill.setColor(colors.color.arrow);
    canvas.drawPath(arrow, kit.fill);
    canvas.restore();
  }
  if (frame.highlight.hinted.some((target) => target.regionId === regionId)) {
    const ring = inset(cell, 0.02);
    kit.stroke.setColor(colors.color.hint);
    kit.stroke.setStrokeWidth(Math.max(2, cell.width * 0.07));
    canvas.drawRRect({ rect: ring, rx: corner, ry: corner }, kit.stroke);
  }
}

/** Pure worklet: reads only its arguments, allocates no Skia objects, reads no clock. */
export function drawBoard(canvas: SkCanvas, frame: Frame): void {
  canvas.drawColor(frame.colors.color.background);
  const grid = fieldGrid(frame);
  if (grid === null) return;
  drawField(canvas, frame, grid);
  drawPen(canvas, frame, grid);
  drawRocks(canvas, frame, grid);
  drawWolves(canvas, frame, grid);
  drawSheep(canvas, frame, grid);
  drawBursts(canvas, frame, grid);
  drawWashes(canvas, frame, grid);
  for (const [direction, turn] of KEY_TURN) drawKey(canvas, frame, { direction, turn });
}
