// packages/shell/src/game-host/record-board.ts
'worklet';

import { sampleTimeline } from '@e07/game-kit/timeline/sample.ts';

import { sceneElapsedMs } from './board-scene.ts';
import { describeError } from './describe-error.ts';
import { coachHandGlide, drawCoachHand } from './draw-coach-hand.ts';

import type { BoardScene } from './board-scene.ts';
import type {
  BoardColors,
  BoardHighlight,
  DrawFrame,
  PointerSample,
  RenderKit,
} from './board-types.ts';
import type { BoardCoachHand, CoachHandDraw } from './draw-coach-hand.ts';
import type { BoardLayout } from '@e07/game-kit/geom/board-layout.ts';
import type { SkCanvas, SkPicture, SkPictureRecorder } from '@shopify/react-native-skia';

export type RecordInput<TView, TToken extends string> = {
  readonly scene: BoardScene<TView>;
  readonly now: number;
  readonly layout: BoardLayout;
  readonly pointer: PointerSample;
  readonly highlight: BoardHighlight;
  readonly colors: BoardColors<TToken>;
  readonly kit: RenderKit;
  readonly draw: (canvas: SkCanvas, frame: DrawFrame<TView, TToken>) => void;
  /** Must itself be a worklet (it runs on the UI thread); it forwards with scheduleOnRN. */
  readonly onError: (message: string) => void;
  /**
   * The tutorial's pointing hand at rest, drawn over the game's picture (the S13 pictures, each
   * recorded once), or null. A live board draws its gliding hand as its own picture instead
   * (recordCoachHand), so the board is not recorded again on every step of the glide.
   */
  readonly restingHand: BoardCoachHand | null;
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
      highlight: input.highlight,
      colors: input.colors,
      layout: input.layout,
      kit: input.kit,
    });
    const hand = input.restingHand;
    if (hand !== null) {
      const glide = coachHandGlide(input.layout, hand);
      drawCoachHand(canvas, { glide, look: hand.look, kit: input.kit }, 1);
    }
  } catch (error) {
    input.onError(describeError(error));
  }
  return recorder.finishRecordingAsPicture();
}

/**
 * The tutorial's pointing hand at `phase`, recorded as its own picture over the board's: as the
 * hand glides, only this picture is recorded again, never the board's.
 */
export function recordCoachHand(
  recorder: SkPictureRecorder,
  hand: CoachHandDraw & { readonly layout: BoardLayout },
  phase: number,
): SkPicture {
  const canvas = recorder.beginRecording({
    x: 0,
    y: 0,
    width: hand.layout.width,
    height: hand.layout.height,
  });
  drawCoachHand(canvas, hand, phase);
  return recorder.finishRecordingAsPicture();
}
