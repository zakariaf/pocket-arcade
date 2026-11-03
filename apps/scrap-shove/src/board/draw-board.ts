// apps/scrap-shove/src/board/draw-board.ts
'worklet';

import { floorRect } from './board-geometry.ts';
import { drawEffects } from './draw-effects.ts';
import { drawArrows, drawFloor, drawPlayer } from './draw-floor.ts';
import { drawHeaps, drawSmashedHeaps } from './draw-heaps.ts';
import { drawGhosts, drawRobots } from './draw-robots.ts';

import type { Frame } from './board-geometry.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

/**
 * Pure worklet: reads only its arguments, allocates no Skia objects, reads no clock. Back to
 * front: the floor, the heaps, the player, the robots (a catching robot covers the player), the
 * robots breaking down this turn, the robots' next-step arrows on the edges they will cross, then
 * the effects. The layers that walk a channel's keys share one list of the frame's keys.
 */
export function drawBoard(canvas: SkCanvas, frame: Frame): void {
  canvas.drawColor(frame.colors.color.background);
  const floor = floorRect(frame);
  if (floor === null) return;
  const keys = Object.keys(frame.fx.entries);
  drawFloor(canvas, frame, floor);
  drawHeaps(canvas, frame);
  drawSmashedHeaps(canvas, frame, keys);
  drawPlayer(canvas, frame);
  drawRobots(canvas, frame);
  drawGhosts(canvas, frame, keys);
  drawArrows(canvas, frame);
  drawEffects(canvas, frame, { floor, keys });
}
