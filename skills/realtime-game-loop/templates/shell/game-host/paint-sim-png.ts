// packages/shell/src/game-host/paint-sim-png.ts
// device-only: covered by the arena pixel golden (test/goldens/boards/<game>-board.golden.test.ts, real CanvasKit).
// Offscreen render of a real-time board with the SAME draw() the device runs (recordSim calls it
// inside the Picture). Used by the board's pixel golden (Jest, CanvasKit) and by Node art scripts
// (headless Skia). Takes the Skia API as a parameter, like paintBoardPng.
import type { SkiaApi } from './board-types.ts';
import type { SimFrame } from './record-sim.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

export type SimPngRequest<TSim, TToken extends string> = SimFrame<TSim, TToken> & {
  readonly draw: (canvas: SkCanvas, frame: SimFrame<TSim, TToken>) => void;
};

export function paintSimPng<TSim, TToken extends string>(
  skia: SkiaApi,
  request: SimPngRequest<TSim, TToken>,
): Uint8Array {
  const surface = skia.Surface.Make(request.width, request.height);
  if (surface === null) throw new Error('Offscreen surface unavailable');
  const { sim, width, height, colors, kit } = request;
  request.draw(surface.getCanvas(), { sim, width, height, colors, kit });
  surface.flush();
  return surface.makeImageSnapshot().encodeToBytes();
}
