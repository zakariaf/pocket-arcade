// apps/demo-arena/src/board/draw-arena.ts
'worklet';

import { ARENA } from '@e07/demo-arena/sim/demo-arena-sim.ts';

import type { BoardToken } from './board-palettes.ts';
import type { DemoArenaSim } from '@e07/demo-arena/sim/demo-arena-sim.ts';
import type { SimFrame } from '@e07/shell/game-host/record-sim.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

type Frame = SimFrame<DemoArenaSim, BoardToken>;

const PLAYER_RADIUS = 18;
const ENTITY_RADIUS = 12;

/**
 * Pure worklet: reads the live sim in place and scales the square world to the canvas, with a
 * margin of one player radius so a body on the arena edge is never clipped. Free-form worlds need
 * no BoardLayout regions. Over ~100 identical sprites, draw them with an Atlas (one draw call)
 * instead of one drawCircle each.
 */
export function drawArena(canvas: SkCanvas, frame: Frame): void {
  const { sim, colors, kit } = frame;
  const scale = Math.min(frame.width, frame.height) / (ARENA + 2 * PLAYER_RADIUS);
  const offsetX = (frame.width - ARENA * scale) / 2;
  const offsetY = (frame.height - ARENA * scale) / 2;
  canvas.drawColor(colors.color.background);
  const count = sim.ints[1] ?? 0;
  for (let e = 0; e < count; e += 1) {
    const x = offsetX + (sim.body[e * 4] ?? 0) * scale;
    const y = offsetY + (sim.body[e * 4 + 1] ?? 0) * scale;
    kit.fill.setColor(e === 0 ? colors.color.player : colors.color.enemy);
    canvas.drawCircle(x, y, (e === 0 ? PLAYER_RADIUS : ENTITY_RADIUS) * scale, kit.fill);
  }
}
