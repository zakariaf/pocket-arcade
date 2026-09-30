// apps/tap-flip/src/board/tap-flip-board.ts
import { drawBoard } from './draw-board.ts';
import { layoutBoard } from './layout-board.ts';
import { toView } from './to-view.ts';

import type { BoardToken } from './board-palettes.ts';
import type { TapFlipView } from './to-view.ts';
import type {
  TapFlipMove,
  TapFlipState,
} from '@e07/tap-flip/rules/tap-flip-types.ts';
import type { GameBoard, SkiaApi } from '@e07/shell/game-host/board-types.ts';
import type { SkPath } from '@shopify/react-native-skia';

/** Unit-size (0…1) shapes, built ONCE per kit with the immutable path API (Skia 2.6+). */
function buildPaths(skia: SkiaApi): Readonly<Partial<Record<string, SkPath>>> {
  // The lit mark: a four-point star, so lit cells differ by shape as well as colour.
  const mark = skia.PathBuilder.Make()
    .moveTo(0.5, 0)
    .lineTo(0.62, 0.38)
    .lineTo(1, 0.5)
    .lineTo(0.62, 0.62)
    .lineTo(0.5, 1)
    .lineTo(0.38, 0.62)
    .lineTo(0, 0.5)
    .lineTo(0.38, 0.38)
    .close()
    .build();
  return { mark };
}

/** The rendering members of the game module (presentation.board of its ShellGameModule). */
export const tapFlipBoard: GameBoard<
  TapFlipState,
  TapFlipView,
  BoardToken,
  TapFlipMove
> = {
  isMirroredInRtl: false,
  toView,
  layout: layoutBoard,
  draw: drawBoard,
  buildPaths,
  describe: (view) => ({
    id: 'tap-flip.board.summary',
    values: { litCount: view.cells.filter((cell) => cell === 1).length },
  }),
  // The hinted move is one tapped cell; the host rings it (frame.highlight.hinted).
  targetsOfMove: (_state, move) => [{ regionId: 'board', col: move.col, row: move.row }],
};
