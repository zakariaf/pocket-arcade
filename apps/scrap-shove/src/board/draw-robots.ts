// apps/scrap-shove/src/board/draw-robots.ts
'worklet';

import { trackKey } from '@e07/game-kit/timeline/sample.ts';

import { centred, drawUnitPath, trackedSquare } from './board-geometry.ts';
import { kindAt, robotEntity } from './board-ids.ts';

import type { Frame } from './board-geometry.ts';
import type { RobotKindName } from './board-ids.ts';
import type { Rect } from '@e07/game-kit/geom/board-layout.ts';
import type { SkCanvas, SkColor } from '@shopify/react-native-skia';

/** A robot to draw: its kind, its square (mid-slide squares are fractional) and its opacity. */
type Body = { readonly kind: RobotKindName; readonly square: Rect; readonly alpha: number };

/** A body with its head placed on its square. */
type Robot = Body & { readonly head: Rect };

/** Head size as a share of the square: heavy robots are bigger, so size is a cue as well as shape. */
const HEAD = { normal: 0.56, fast: 0.5, heavy: 0.7 } as const;
const EDGE = 0.05;

function setFill(frame: Frame, color: SkColor, alpha: number): void {
  frame.kit.fill.setColor(color);
  frame.kit.fill.setAlphaf(alpha);
}

/** The head: a blocky rounded square with an ink edge (the Toybox rule: fills carry an edge). */
function drawHead(canvas: SkCanvas, frame: Frame, robot: Robot): void {
  const { kit, colors } = frame;
  const { head } = robot;
  const corner = head.width * 0.22;
  setFill(frame, colors.color[robot.kind], robot.alpha);
  canvas.drawRRect({ rect: head, rx: corner, ry: corner }, kit.fill);
  kit.stroke.setColor(colors.color.frame);
  kit.stroke.setAlphaf(robot.alpha);
  kit.stroke.setStrokeWidth(Math.max(1, robot.square.width * EDGE));
  canvas.drawRRect({ rect: head, rx: corner, ry: corner }, kit.stroke);
}

/** Two eyes and a mouth line, in the face colour that stands out on the robot's own colour. */
function drawFace(canvas: SkCanvas, frame: Frame, robot: Robot): void {
  const { kit, colors } = frame;
  const { head } = robot;
  const face = robot.kind === 'heavy' ? colors.color.heavyFace : colors.color.robotFace;
  const eyeY = head.y + head.height * 0.42;
  const eye = head.width * 0.09;
  setFill(frame, face, robot.alpha);
  canvas.drawCircle(head.x + head.width * 0.32, eyeY, eye, kit.fill);
  canvas.drawCircle(head.x + head.width * 0.68, eyeY, eye, kit.fill);
  kit.stroke.setColor(face);
  kit.stroke.setAlphaf(robot.alpha);
  kit.stroke.setStrokeWidth(Math.max(1, head.width * 0.07));
  const mouthY = head.y + head.height * 0.72;
  canvas.drawLine(head.x + head.width * 0.3, mouthY, head.x + head.width * 0.7, mouthY, kit.stroke);
}

/** Normal and fast robots wear an antenna; heavy robots two bolts on the top corners. */
function drawTop(canvas: SkCanvas, frame: Frame, robot: Robot): void {
  const { kit, colors } = frame;
  const { head } = robot;
  const top = head.y + head.height * 0.18;
  if (robot.kind === 'heavy') {
    setFill(frame, colors.color.heavyFace, robot.alpha);
    canvas.drawCircle(head.x + head.width * 0.18, top, head.width * 0.06, kit.fill);
    canvas.drawCircle(head.x + head.width * 0.82, top, head.width * 0.06, kit.fill);
    return;
  }
  const cx = head.x + head.width / 2;
  kit.stroke.setColor(colors.color.frame);
  kit.stroke.setAlphaf(robot.alpha);
  kit.stroke.setStrokeWidth(Math.max(1, head.width * 0.06));
  canvas.drawLine(cx, head.y, cx, head.y - head.height * 0.22, kit.stroke);
  setFill(frame, colors.color.frame, robot.alpha);
  canvas.drawCircle(cx, head.y - head.height * 0.24, head.width * 0.08, kit.fill);
}

/** Fast robots carry a fin on each side: the shape that tells them apart in every palette. */
function drawFins(canvas: SkCanvas, frame: Frame, robot: Robot): void {
  const { finWest, finEast } = frame.kit.paths;
  if (robot.kind !== 'fast' || finWest === undefined || finEast === undefined) return;
  const { head } = robot;
  const size = head.width * 0.4;
  const y = head.y + (head.height - size) / 2;
  setFill(frame, frame.colors.color.fast, robot.alpha);
  const west = { x: head.x - size * 0.8, y, width: size, height: size };
  const east = { x: head.x + head.width - size * 0.2, y, width: size, height: size };
  drawUnitPath(canvas, frame, { path: finWest, rect: west });
  drawUnitPath(canvas, frame, { path: finEast, rect: east });
}

/** One robot, any kind; restores the scratch paints' opacity when done. */
function drawRobotBody(canvas: SkCanvas, frame: Frame, body: Body): void {
  const robot = { ...body, head: centred(body.square, HEAD[body.kind]) };
  drawFins(canvas, frame, robot);
  drawHead(canvas, frame, robot);
  drawTop(canvas, frame, robot);
  drawFace(canvas, frame, robot);
  frame.kit.fill.setAlphaf(1);
  frame.kit.stroke.setAlphaf(1);
}

/** The robots of the final view, each where its step track has it (or on its square). */
export function drawRobots(canvas: SkCanvas, frame: Frame): void {
  for (const robot of frame.view.robots) {
    const key = trackKey('robot', robotEntity(robot.id));
    const square = trackedSquare(frame, key, [robot.col, robot.row]);
    if (square !== null) drawRobotBody(canvas, frame, { kind: robot.kind, square, alpha: 1 });
  }
}

/** Robots that broke down this turn are gone from the view: their ghost tracks carry them. */
export function drawGhosts(canvas: SkCanvas, frame: Frame): void {
  for (const key of Object.keys(frame.fx.entries)) {
    const ghost = frame.fx.entries[key];
    if (!key.startsWith('ghost:') || ghost === undefined) continue;
    const alpha = ghost.values[3] ?? 0;
    // Its last step, if it took one this turn, brings it to where it broke.
    const square = trackedSquare(frame, `robot:${key.slice('ghost:'.length)}`, ghost.values);
    if (square === null || alpha <= 0) continue;
    drawRobotBody(canvas, frame, { kind: kindAt(ghost.values[2] ?? 0), square, alpha });
  }
}
