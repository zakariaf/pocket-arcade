// apps/line-siege/src/board/draw-board.ts
'worklet';

import { cellRect } from '@e07/game-kit/geom/board-layout.ts';
import { fxEntry } from '@e07/game-kit/timeline/sample.ts';

import { cellEntity, heartEntity, TURN_ENTITY } from './board-ids.ts';
import { drawBursts, drawMonsters, drawVanishing } from './draw-monsters.ts';
import { drawBlock, inset, INSET, isPlaying } from './draw-parts.ts';
import { drawGhost, drawHinted, drawTray } from './draw-tray.ts';
import { lanePoint, wallRect } from './layout-board.ts';

import type { Frame } from './draw-parts.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

const SHAKE_PT = 6;
const HEART_SHARE = 0.8;

function drawLanes(canvas: SkCanvas, frame: Frame): void {
  const { view, layout, colors, kit } = frame;
  for (let lane = 0; lane < view.size; lane += 1) {
    const far = lanePoint(layout, view, { lane, row: 0 });
    const near = lanePoint(layout, view, { lane, row: view.laneRows - 1 });
    const top = cellRect(layout, { regionId: 'board', col: lane, row: 0 });
    if (far === null || near === null || top === null) continue;
    const y = far.y - far.step / 2;
    kit.fill.setColor(colors.color.lane);
    kit.fill.setAlphaf(lane % 2 === 0 ? 1 : 0.7);
    canvas.drawRect(
      { x: top.x, y, width: top.width, height: near.y + near.step / 2 - y },
      kit.fill,
    );
  }
  kit.fill.setAlphaf(1);
}

function drawHeart(
  canvas: SkCanvas,
  frame: Frame,
  heart: { readonly x: number; readonly y: number; readonly size: number; readonly scale: number },
): void {
  const { kit, colors } = frame;
  const shape = kit.paths['heart'];
  kit.stroke.setColor(colors.color.heart);
  kit.stroke.setStrokeWidth(Math.max(1, heart.size * 0.1));
  const inner = heart.size * Math.max(0, Math.min(1.2, heart.scale));
  const cx = heart.x + heart.size / 2;
  const cy = heart.y + heart.size / 2;
  kit.fill.setColor(colors.color.heart);
  if (shape === undefined) {
    canvas.drawCircle(cx, cy, heart.size / 2, kit.stroke);
    if (inner > 0) canvas.drawCircle(cx, cy, inner / 2, kit.fill);
    return;
  }
  canvas.save();
  canvas.translate(heart.x, heart.y);
  canvas.scale(heart.size, heart.size);
  kit.stroke.setStrokeWidth(0.1);
  canvas.drawPath(shape, kit.stroke);
  canvas.restore();
  if (inner <= 0) return;
  canvas.save();
  canvas.translate(cx - inner / 2, cy - inner / 2);
  canvas.scale(inner, inner);
  canvas.drawPath(shape, kit.fill);
  canvas.restore();
}

/** The wall and its hearts: filled while kept, an outline once lost; 'heart' tracks size them. */
function drawWall(canvas: SkCanvas, frame: Frame): void {
  const { view, colors, kit, fx } = frame;
  const wall = wallRect(frame.layout, view);
  if (wall === null) return;
  kit.fill.setColor(colors.color.wall);
  canvas.drawRect(wall, kit.fill);
  const size = wall.height * HEART_SHARE;
  for (let i = 0; i < view.maxHearts; i += 1) {
    const at = {
      x: wall.x + wall.height * 0.2 + i * wall.height,
      y: wall.y + (wall.height - size) / 2,
    };
    const grow = fxEntry(fx, 'heart', heartEntity(i))?.values[0];
    const scale = grow ?? (i < view.hearts ? 1 : 0);
    drawHeart(canvas, frame, { ...at, size, scale });
  }
}

/** How a cell shows now: its block's opacity (0 = empty) and its pop size. */
function cellLook(
  frame: Frame,
  index: number,
  entity: number,
): { readonly fade: number; readonly pop: number } {
  if (frame.view.cells[index] === 1)
    return { fade: 1, pop: fxEntry(frame.fx, 'pop', entity)?.values[0] ?? 1 };
  return { fade: fxEntry(frame.fx, 'clear', entity)?.values[0] ?? 0, pop: 1 };
}

/** Empty cells, then blocks: a placed block pops in, a cleared one fades out over its empty cell. */
function drawCells(canvas: SkCanvas, frame: Frame): void {
  const { view, layout, colors, kit } = frame;
  for (let i = 0; i < view.cells.length; i += 1) {
    const at = { col: i % view.size, row: Math.floor(i / view.size) };
    const rect = cellRect(layout, { regionId: 'board', ...at });
    if (rect === null) continue;
    const { fade, pop } = cellLook(frame, i, cellEntity(at.col, at.row));
    const corner = rect.width * 0.14;
    kit.fill.setColor(colors.color.cell);
    if (view.cells[i] !== 1)
      canvas.drawRRect({ rect: inset(rect, INSET), rx: corner, ry: corner }, kit.fill);
    if (fade <= 0) continue;
    kit.fill.setColor(colors.color.block);
    drawBlock(canvas, frame, { rect: inset(rect, INSET + (1 - pop) / 2), alpha: fade });
  }
}

function drawBeams(canvas: SkCanvas, frame: Frame): void {
  const { view, layout, colors, kit, fx } = frame;
  for (let lane = 0; lane < view.size; lane += 1) {
    const beam = fxEntry(fx, 'beam', lane);
    const bottom = cellRect(layout, { regionId: 'board', col: lane, row: view.size - 1 });
    const far = lanePoint(layout, view, { lane, row: 0 });
    if (!isPlaying(beam) || bottom === null || far === null) continue;
    const base = bottom.y + bottom.height;
    const height = (base - (far.y - far.step / 2)) * beam.progress;
    const width = bottom.width * 0.4;
    const rect = { x: bottom.x + (bottom.width - width) / 2, y: base - height, width, height };
    kit.fill.setColor(colors.color.beam);
    drawBlock(canvas, frame, { rect, alpha: 1 - beam.progress * 0.5 });
  }
}

/** A band that sweeps the lanes: the shockwave (up from the wall) and the continue's push-back. */
function drawWave(canvas: SkCanvas, frame: Frame, channel: 'shock' | 'push'): void {
  const { view, layout, colors, kit, fx } = frame;
  const wave = fxEntry(fx, channel, TURN_ENTITY);
  const near = lanePoint(layout, view, { lane: 0, row: view.laneRows - 1 });
  const wall = wallRect(layout, view);
  if (!isPlaying(wave) || near === null || wall === null) return;
  kit.fill.setColor(colors.color.shock);
  kit.fill.setAlphaf(1 - wave.progress);
  const y = wall.y - near.step * view.laneRows * wave.progress - near.step;
  canvas.drawRect(
    { x: wall.x, y, width: wall.width, height: near.step * (channel === 'push' ? 2 : 1) },
    kit.fill,
  );
  kit.fill.setAlphaf(1);
}

/** Pure worklet: reads only its arguments, allocates no Skia objects, reads no clock. */
export function drawBoard(canvas: SkCanvas, frame: Frame): void {
  canvas.drawColor(frame.colors.color.background);
  const shake = fxEntry(frame.fx, 'shake', TURN_ENTITY);
  const offset = isPlaying(shake) ? (shake.values[0] ?? 0) * SHAKE_PT : 0;
  canvas.save();
  canvas.translate(offset * (Math.floor(frame.fx.elapsedMs / 40) % 2 === 0 ? 1 : -1), 0);
  drawLanes(canvas, frame);
  drawWall(canvas, frame);
  drawCells(canvas, frame);
  drawHinted(canvas, frame);
  drawBeams(canvas, frame);
  drawWave(canvas, frame, 'shock');
  drawWave(canvas, frame, 'push');
  drawMonsters(canvas, frame);
  drawVanishing(canvas, frame);
  drawBursts(canvas, frame);
  canvas.restore();
  drawTray(canvas, frame);
  drawGhost(canvas, frame);
}
