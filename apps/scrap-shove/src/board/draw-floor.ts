// apps/scrap-shove/src/board/draw-floor.ts
'worklet';

import { fxEntry, trackKey } from '@e07/game-kit/timeline/sample.ts';
import { setPaintColor } from '@e07/shell/game-host/board-kit.ts';

import {
  centred,
  drawUnitPath,
  inset,
  isPlaying,
  squareAt,
  trackedSquare,
} from './board-geometry.ts';
import { PLAYER_ENTITY, TURN_ENTITY } from './board-ids.ts';

import type { Frame } from './board-geometry.ts';
import type { RobotView } from './to-view.ts';
import type { Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

const TILE_INSET = 0.04;
const CORNER = 0.16;
const EDGE = 0.05;
const PLAYER_SIZE = 0.62;
const ARROW_SIZE = 0.3;
/** The arrow sits on the edge the robot will cross, half in the square it steps to. */
const ARROW_REACH = 0.5;

/**
 * Degrees to turn the east-pointing unit arrow for each next step (index (stepRow + 1) * 3 +
 * stepCol + 1): a table instead of atan2, so draw() stays free of transcendental Math.
 */
const ARROW_DEGREES = [225, 270, 315, 180, 0, 0, 135, 90, 45] as const;

/** The floor: grout, the tiles, then the ink frame around them. */
export function drawFloor(canvas: SkCanvas, frame: Frame, floor: Rect): void {
  const { kit, colors, view } = frame;
  const corner = floor.width * 0.03;
  kit.fill.setColor(colors.color.grid);
  canvas.drawRRect({ rect: floor, rx: corner, ry: corner }, kit.fill);
  kit.fill.setColor(colors.color.floor);
  for (let index = 0; index < view.cols * view.rows; index += 1) {
    const square = squareAt(frame.layout, index % view.cols, Math.floor(index / view.cols));
    if (square === null) continue;
    const tile = inset(square, TILE_INSET);
    canvas.drawRRect({ rect: tile, rx: tile.width * CORNER, ry: tile.width * CORNER }, kit.fill);
  }
  kit.stroke.setColor(colors.color.frame);
  kit.stroke.setStrokeWidth(Math.max(2, floor.width * 0.006));
  canvas.drawRRect({ rect: floor, rx: corner, ry: corner }, kit.stroke);
}

/** One robot's next step: a small arrow on the edge of its square, pointing where it will go. */
function drawArrow(canvas: SkCanvas, frame: Frame, robot: RobotView): void {
  const arrow = frame.kit.paths['arrow'];
  const square = squareAt(frame.layout, robot.col, robot.row);
  const isStill = robot.stepCol === 0 && robot.stepRow === 0;
  if (arrow === undefined || square === null || isStill) return;
  const degrees = ARROW_DEGREES[(robot.stepRow + 1) * 3 + robot.stepCol + 1] ?? 0;
  const size = square.width * ARROW_SIZE;
  const cx = square.x + square.width / 2 + robot.stepCol * square.width * ARROW_REACH;
  const cy = square.y + square.height / 2 + robot.stepRow * square.height * ARROW_REACH;
  canvas.save();
  canvas.rotate(degrees, cx, cy);
  const rect = { x: cx - size / 2, y: cy - size / 2, width: size, height: size };
  drawUnitPath(canvas, frame, { path: arrow, rect });
  canvas.restore();
}

/** The robots' next steps, faded in once the turn stands still (always shown on an idle board). */
export function drawArrows(canvas: SkCanvas, frame: Frame): void {
  // The arrows track starts when every robot stands on its final square: before that alpha is 0.
  const alpha = fxEntry(frame.fx, 'arrows', TURN_ENTITY)?.values[0] ?? 1;
  if (alpha <= 0) return;
  setPaintColor(frame.kit.fill, frame.colors.color.arrow, alpha);
  for (const robot of frame.view.robots) drawArrow(canvas, frame, robot);
}

/** The wait pulse: a ring that grows and fades around the player. */
function drawWait(canvas: SkCanvas, frame: Frame, body: Rect): void {
  const wait = fxEntry(frame.fx, 'wait', PLAYER_ENTITY);
  if (!isPlaying(wait)) return;
  const pulse = wait.values[0] ?? 0;
  const { stroke } = frame.kit;
  setPaintColor(stroke, frame.colors.color.player, 1 - pulse);
  stroke.setStrokeWidth(Math.max(2, body.width * 0.08));
  const radius = (body.width / 2) * (1 + pulse * 0.6);
  canvas.drawCircle(body.x + body.width / 2, body.y + body.height / 2, radius, stroke);
  stroke.setAlphaf(1);
}

/** The player: a round body with an ink edge and two eyes, where the step track has it. */
export function drawPlayer(canvas: SkCanvas, frame: Frame): void {
  const { kit, colors, view } = frame;
  const key = trackKey('player', PLAYER_ENTITY);
  const square = trackedSquare(frame, key, [view.player.col, view.player.row]);
  if (square === null) return;
  const body = centred(square, PLAYER_SIZE);
  const cx = body.x + body.width / 2;
  const cy = body.y + body.height / 2;
  const eyeY = cy - body.height * 0.06;
  kit.fill.setColor(colors.color.player);
  canvas.drawCircle(cx, cy, body.width / 2, kit.fill);
  kit.stroke.setColor(colors.color.frame);
  kit.stroke.setStrokeWidth(Math.max(1, square.width * EDGE));
  canvas.drawCircle(cx, cy, body.width / 2, kit.stroke);
  kit.fill.setColor(colors.color.playerFace);
  canvas.drawCircle(cx - body.width * 0.17, eyeY, body.width * 0.08, kit.fill);
  canvas.drawCircle(cx + body.width * 0.17, eyeY, body.width * 0.08, kit.fill);
  drawWait(canvas, frame, body);
}
