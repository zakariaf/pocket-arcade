// apps/toggle-drop/src/board/draw-board.ts
'worklet';

import { fxEntry } from '@e07/game-kit/timeline/sample.ts';

import { switchEntity } from './board-ids.ts';
import { drawBall, drawCups } from './draw-cups.ts';

import type { BoardToken } from './board-palettes.ts';
import type { ToggleDropView } from './to-view.ts';
import type { GridRegion, Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { DrawFrame } from '@e07/shell/game-host/board-types.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

type Frame = DrawFrame<ToggleDropView, BoardToken>;

/** One switch of the board: its peg row, its column and its side (0 left, 1 right). */
type SwitchSpot = {
  readonly region: GridRegion;
  readonly row: number;
  readonly col: number;
  readonly peg: number;
};

/** Shares of a cell. */
const LANE_INSET = 0.07;
const LANE_CORNER = 0.22;
const LEVER_LENGTH = 0.86;
const LEVER_THICK = 0.22;
const PIVOT = 0.09;
const EDGE = 0.045;
const HOPPER = 0.42;
const HINT = 0.07;
const RACK_BALL = 0.16;
const RACK_STEP = 0.42;
/** How far a lever tilts toward its side, in degrees (a switch pointing right tilts down right). */
const LEVER_DEG = 26;

/** The column's lane, from the chute on top to its cup. */
export function laneRect(region: GridRegion, rows: number, col: number): Rect {
  const inset = region.cell * LANE_INSET;
  return {
    x: region.x + col * region.cell + inset,
    y: region.y + inset,
    width: region.cell - 2 * inset,
    height: (rows + 2) * region.cell - 2 * inset,
  };
}

function drawLanes(canvas: SkCanvas, frame: Frame, region: GridRegion): void {
  const corner = region.cell * LANE_CORNER;
  frame.kit.fill.setColor(frame.colors.color.lane);
  for (let col = 0; col < frame.view.cols; col += 1) {
    const rect = laneRect(region, frame.view.rows, col);
    canvas.drawRRect({ rect, rx: corner, ry: corner }, frame.kit.fill);
  }
}

/** A downward hopper at the top of every lane: tap a column to drop a ball there. */
function drawChutes(canvas: SkCanvas, frame: Frame, region: GridRegion): void {
  const hopper = frame.kit.paths['hopper'];
  if (hopper === undefined) return;
  const size = region.cell * HOPPER;
  const offset = (region.cell - size) / 2;
  frame.kit.fill.setColor(frame.colors.color.chute);
  for (let col = 0; col < frame.view.cols; col += 1) {
    canvas.save();
    canvas.translate(region.x + col * region.cell + offset, region.y + offset);
    canvas.scale(size, size);
    canvas.drawPath(hopper, frame.kit.fill);
    canvas.restore();
  }
}

/** The host's hinted drop: a ring around the hinted column's lane (EMPTY_HIGHLIGHT draws nothing). */
function drawHinted(canvas: SkCanvas, frame: Frame, region: GridRegion): void {
  const corner = region.cell * LANE_CORNER;
  frame.kit.stroke.setColor(frame.colors.color.hint);
  frame.kit.stroke.setStrokeWidth(Math.max(2, region.cell * HINT));
  for (const target of frame.highlight.hinted) {
    if (target.regionId !== 'board' || target.col < 0 || target.col >= frame.view.cols) continue;
    const rect = laneRect(region, frame.view.rows, target.col);
    canvas.drawRRect({ rect, rx: corner, ry: corner }, frame.kit.stroke);
  }
}

/** A switch's tilt from -1 (left) to 1 (right): its swing while it flips, else its side. */
function tiltOf(frame: Frame, spot: SwitchSpot): number {
  const swing = fxEntry(frame.fx, 'switch', switchEntity(spot.row, spot.col));
  return swing?.values[0] ?? (spot.peg === 0 ? -1 : 1);
}

/** One flip switch: a white lever on a pivot, tilted down toward the side it sends the ball. */
function drawSwitch(canvas: SkCanvas, frame: Frame, spot: SwitchSpot): void {
  const { region } = spot;
  const cx = region.x + (spot.col + 0.5) * region.cell;
  const cy = region.y + (spot.row + 1.5) * region.cell;
  const length = region.cell * LEVER_LENGTH;
  const thick = region.cell * LEVER_THICK;
  const rect = { x: -length / 2, y: -thick / 2, width: length, height: thick };
  const lever = { rect, rx: thick / 2, ry: thick / 2 };
  canvas.save();
  canvas.translate(cx, cy);
  canvas.rotate(tiltOf(frame, spot) * LEVER_DEG, 0, 0);
  frame.kit.fill.setColor(frame.colors.color.lever);
  canvas.drawRRect(lever, frame.kit.fill);
  frame.kit.stroke.setColor(frame.colors.color.edge);
  frame.kit.stroke.setStrokeWidth(Math.max(1, region.cell * EDGE));
  canvas.drawRRect(lever, frame.kit.stroke);
  canvas.restore();
  frame.kit.fill.setColor(frame.colors.color.pivot);
  canvas.drawCircle(cx, cy, region.cell * PIVOT, frame.kit.fill);
}

function drawSwitches(canvas: SkCanvas, frame: Frame, region: GridRegion): void {
  const { cols, pegs } = frame.view;
  for (let index = 0; index < pegs.length; index += 1) {
    const peg = pegs[index] ?? -1;
    if (peg === -1) continue;
    const spot = { region, row: Math.floor(index / cols), col: index % cols, peg };
    drawSwitch(canvas, frame, spot);
  }
}

/** The balls left, in a centred rack in the row above the chutes (the final count of the move). */
function drawRack(canvas: SkCanvas, frame: Frame, region: GridRegion): void {
  const count = frame.view.ballsLeft;
  const step = region.cell * RACK_STEP;
  const radius = region.cell * RACK_BALL;
  const x0 = region.x + (region.cols * region.cell - (count - 1) * step) / 2;
  const y = region.y - region.cell / 2;
  frame.kit.fill.setColor(frame.colors.color.ball);
  frame.kit.stroke.setColor(frame.colors.color.edge);
  frame.kit.stroke.setStrokeWidth(Math.max(1, region.cell * EDGE));
  for (let i = 0; i < count; i += 1) {
    canvas.drawCircle(x0 + i * step, y, radius, frame.kit.fill);
    canvas.drawCircle(x0 + i * step, y, radius, frame.kit.stroke);
  }
}

/** Pure worklet: reads only its arguments, allocates no Skia objects, reads no clock. */
export function drawBoard(canvas: SkCanvas, frame: Frame): void {
  canvas.drawColor(frame.colors.color.background);
  const region = frame.layout.regions.find((candidate) => candidate.id === 'board');
  if (region === undefined || region.cell <= 0) return;
  drawRack(canvas, frame, region);
  drawLanes(canvas, frame, region);
  drawChutes(canvas, frame, region);
  drawHinted(canvas, frame, region);
  drawSwitches(canvas, frame, region);
  drawCups(canvas, frame, region);
  drawBall(canvas, frame, region);
}
