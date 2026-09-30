// packages/shell/src/game-host/record-board.ts
'worklet';

import { sampleTimeline } from '@e07/game-kit/timeline/sample.ts';

import { sceneElapsedMs } from './board-scene.ts';
import { describeError } from './describe-error.ts';

import type { BoardScene } from './board-scene.ts';
import type { BoardColors, DrawFrame, PointerSample, RenderKit } from './board-types.ts';
import type { BoardLayout } from '@e07/game-kit/geom/board-layout.ts';
import type { SkCanvas, SkPicture, SkPictureRecorder } from '@shopify/react-native-skia';

export type RecordInput<TView, TToken extends string> = {
  readonly scene: BoardScene<TView>;
  readonly now: number;
  readonly layout: BoardLayout;
  readonly pointer: PointerSample;
  readonly colors: BoardColors<TToken>;
  readonly kit: RenderKit;
  readonly draw: (canvas: SkCanvas, frame: DrawFrame<TView, TToken>) => void;
  /** Must itself be a worklet (it runs on the UI thread); it forwards with scheduleOnRN. */
  readonly onError: (message: string) => void;
};

/**
 * Records one frame into a Picture. Runs inside useDerivedValue on the UI thread.
 * A draw() exception must not crash the app: report it and return an empty picture.
 */
export function recordBoard<TView, TToken extends string>(
  recorder: SkPictureRecorder,
  input: RecordInput<TView, TToken>,
): SkPicture {
  const canvas = recorder.beginRecording({
    x: 0,
    y: 0,
    width: input.layout.width,
    height: input.layout.height,
  });
  try {
    const timeline = sampleTimeline(input.scene.tracks, sceneElapsedMs(input.scene, input.now));
    input.draw(canvas, {
      view: input.scene.view,
      fx: { ...timeline, pointer: input.pointer },
      colors: input.colors,
      layout: input.layout,
      kit: input.kit,
    });
  } catch (error) {
    runOnJS(input.onError)(describeError(error));
  }
  return recorder.finishRecordingAsPicture();
}
