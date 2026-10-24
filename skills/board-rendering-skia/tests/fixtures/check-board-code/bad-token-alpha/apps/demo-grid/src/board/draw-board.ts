// apps/demo-grid/src/board/draw-board.ts
'worklet';

import type { BoardToken } from './board-palettes.ts';
import type { DemoGridView } from './to-view.ts';
import type { DrawFrame } from '@e07/shell/game-host/board-types.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

type Frame = DrawFrame<DemoGridView, BoardToken>;

/** The planted bug: the ghost token is translucent, and setAlphaf replaces its own alpha. */
export function drawBoard(canvas: SkCanvas, frame: Frame): void {
  const { kit, colors } = frame;
  kit.fill.setColor(colors.color.ghost);
  kit.fill.setAlphaf(0.6);
  canvas.drawRect({ x: 0, y: 0, width: 10, height: 10 }, kit.fill);
}
