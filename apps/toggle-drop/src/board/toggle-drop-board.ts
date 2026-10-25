// apps/toggle-drop/src/board/toggle-drop-board.ts
import { drawBoard } from './draw-board.ts';
import { layoutBoard } from './layout-board.ts';
import { toView } from './to-view.ts';

import type { BoardToken } from './board-palettes.ts';
import type { ToggleDropView } from './to-view.ts';
import type { GameBoard, SkiaApi } from '@e07/shell/game-host/board-types.ts';
import type { ToggleDropMove, ToggleDropState } from '@e07/toggle-drop/rules/toggle-drop-types.ts';
import type { SkPath } from '@shopify/react-native-skia';

/** Unit-size (0…1) shapes, built ONCE per kit with the immutable path API (Skia 2.6+). */
function buildPaths(skia: SkiaApi): Readonly<Partial<Record<string, SkPath>>> {
  // The chute on top of each lane: a hopper pointing down (drop here).
  const hopper = skia.PathBuilder.Make()
    .moveTo(0, 0.15)
    .lineTo(1, 0.15)
    .lineTo(0.5, 0.85)
    .close()
    .build();
  // A cup: a U with a rim, wider at the top, so a cup differs from the gutter by shape.
  const cup = skia.PathBuilder.Make()
    .moveTo(0.08, 0.18)
    .lineTo(0.92, 0.18)
    .lineTo(0.8, 0.9)
    .lineTo(0.2, 0.9)
    .close()
    .build();
  // A full cup's check mark (a shape, never colour alone).
  const check = skia.PathBuilder.Make()
    .moveTo(0, 0.55)
    .lineTo(0.18, 0.37)
    .lineTo(0.4, 0.6)
    .lineTo(0.82, 0.12)
    .lineTo(1, 0.3)
    .lineTo(0.4, 0.95)
    .close()
    .build();
  return { hopper, cup, check };
}

/** The cups still to fill and the balls left, for the board's spoken summary. */
function summaryOf(view: ToggleDropView): Readonly<Record<string, number>> {
  const cupsLeft = view.needs.filter((need, col) => need > (view.filled[col] ?? 0)).length;
  return { cupsLeft, cupsCount: view.needs.filter((need) => need > 0).length };
}

/** The rendering members of the game module (presentation.board of its ShellGameModule). */
export const toggleDropBoard: GameBoard<
  ToggleDropState,
  ToggleDropView,
  BoardToken,
  ToggleDropMove
> = {
  // A board is a physical space (spec 7.5): the switches tilt the same way in every language.
  isMirroredInRtl: false,
  toView,
  layout: layoutBoard,
  draw: drawBoard,
  buildPaths,
  describe: (view) => ({ id: 'toggle-drop.board.summary', values: summaryOf(view) }),
  // The hinted drop is one column; the host rings its lane (frame.highlight.hinted).
  targetsOfMove: (_state, move) => [{ regionId: 'board', col: move.col, row: 0 }],
};
