// packages/shell/src/game-host/example-picture-aspect.ts
// The S13 how-to-play picture's size contract. The Toybox mockup draws the illustration in a
// 320 x 206 viewBox, full width: the picture gets that aspect ratio unless the game's board says
// otherwise (GameBoard.exampleAspect, width / height). Without a size the example canvas measured
// 0 and drew nothing. Pure, so the S13 view reads it without Skia (GameHost.howToPlayPictureAspect).

import type { GameBoard } from './board-types.ts';

/** The mockup's hxIllustration viewBox, 320 x 206 (width / height). */
export const EXAMPLE_PICTURE_ASPECT = 320 / 206;

/** What the aspect needs from the board module: any GameBoard fits. */
export type ExampleAspectSource = Pick<
  GameBoard<unknown, unknown, string>,
  'isMirroredInRtl' | 'exampleAspect'
>;

/** The board's own positive, finite exampleAspect, else the Toybox picture's 320 / 206. */
export function examplePictureAspectOf(board: ExampleAspectSource): number {
  const aspect = board.exampleAspect;
  return aspect !== undefined && Number.isFinite(aspect) && aspect > 0
    ? aspect
    : EXAMPLE_PICTURE_ASPECT;
}
