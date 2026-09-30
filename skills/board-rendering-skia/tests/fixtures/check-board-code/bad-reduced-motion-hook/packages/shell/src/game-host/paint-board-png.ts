// packages/shell/src/game-host/paint-board-png.ts
// Offscreen render of the SAME draw() the device runs. Used by golden tests (Jest, CanvasKit)
// and by the Node art scripts (headless Skia). Takes the Skia API as a parameter.
import { sampleTimeline } from '@e07/game-kit/timeline/sample.ts';

import { IDLE_POINTER } from './board-types.ts';

import type { BoardColors, DrawFrame, LayoutInput, RenderKit, SkiaApi } from './board-types.ts';
import type { BoardLayout } from '@e07/game-kit/geom/board-layout.ts';
import type { Track } from '@e07/game-kit/timeline/track.ts';
import type { SkCanvas } from '@shopify/react-native-skia';

export type PngRequest<TView, TToken extends string> = {
  readonly draw: (canvas: SkCanvas, frame: DrawFrame<TView, TToken>) => void;
  readonly layout: (input: LayoutInput<TView>) => BoardLayout;
  readonly view: TView;
  readonly tracks: readonly Track[];
  readonly elapsedMs: number;
  readonly colors: BoardColors<TToken>;
  readonly kit: RenderKit;
  readonly width: number;
  readonly height: number;
  readonly isMirrored: boolean;
};

export function paintBoardPng<TView, TToken extends string>(
  skia: SkiaApi,
  request: PngRequest<TView, TToken>,
): Uint8Array {
  const surface = skia.Surface.Make(request.width, request.height);
  if (surface === null) throw new Error('Offscreen surface unavailable');
  const { width, height, view, isMirrored } = request;
  request.draw(surface.getCanvas(), {
    view,
    fx: { ...sampleTimeline(request.tracks, request.elapsedMs), pointer: IDLE_POINTER },
    colors: request.colors,
    layout: request.layout({ width, height, view, isMirrored }),
    kit: request.kit,
  });
  surface.flush();
  return surface.makeImageSnapshot().encodeToBytes();
}
