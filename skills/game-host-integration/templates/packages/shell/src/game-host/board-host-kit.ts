// packages/shell/src/game-host/board-host-kit.ts
// device-only: covered by the simulator board screenshots, the tutorial and the S13 How to play screen (Skia objects; unit Jest has no Skia).
// What a board host draws with, built the same way for a run's board (create-game-board-host.tsx)
// and for the S13 pictures (create-example-picture.tsx): the kit of unit paths, scratch paints and
// the digits font, and the tutorial's pointing hand in the theme's pop paint.
import { Skia } from '@shopify/react-native-skia';

import { makeBoardKit } from '@e07/shell/game-host/board-kit.ts';
import { boardNumberTypeface } from '@e07/shell/game-host/board-number-font.ts';

import type { GameBoard, RenderKit } from '@e07/shell/game-host/board-types.ts';
import type { CoachPointer } from '@e07/shell/game-host/coach-pointer.ts';
import type { BoardCoachHand } from '@e07/shell/game-host/draw-coach-hand.ts';

/** Digits and Latin labels on the canvas: the bundled Vazirmatn (board-number-font.ts). */
const NUMBER_SIZE = 18;

/** A board's unit paths, scratch paints and digits font: built on the JS thread, never per frame. */
export function boardKitOf(
  board: Pick<GameBoard<unknown, unknown, string>, 'buildPaths'>,
): RenderKit {
  return makeBoardKit(Skia, {
    paths: board.buildPaths(Skia),
    numberTypeface: boardNumberTypeface(),
    numberSize: NUMBER_SIZE,
  });
}

/** The theme colours the hand is painted in: the Toybox pop paint and the ink drawn on it. */
export type CoachHandColors = { readonly pop: string; readonly onPop: string };

/** The tutorial's pointing hand for a resolved pointer, in the theme's pop paint; null without one. */
export function boardCoachHandOf(
  pointer: CoachPointer,
  colors: CoachHandColors,
): BoardCoachHand | null {
  if (pointer.hand === null) return null;
  const look = { fill: Skia.Color(colors.pop), ink: Skia.Color(colors.onPop) };
  return { hand: pointer.hand, cells: pointer.cells, look };
}
