// apps/demo-grid/src/board/demo-grid-board.ts

import { drawBoard } from './draw-board.ts';
import { layoutBoard } from './layout-board.ts';
import { toView } from './to-view.ts';

import type { BoardToken } from './board-palettes.ts';
import type { DemoGridView } from './to-view.ts';
import type { DemoGridState } from '@e07/demo-grid/rules/demo-grid-types.ts';
import type { GameBoard, SkiaApi } from '@e07/shell/game-host/board-types.ts';
import type { SkPath } from '@shopify/react-native-skia';

/** A club: three circles and a stem, built with the immutable builder's own add* calls. */
function clubPath(skia: SkiaApi): SkPath {
  return skia.PathBuilder.Make()
    .addCircle(0.5, 0.28, 0.21)
    .addCircle(0.26, 0.58, 0.21)
    .addCircle(0.74, 0.58, 0.21)
    .moveTo(0.5, 0.5)
    .lineTo(0.64, 0.98)
    .lineTo(0.36, 0.98)
    .close()
    .build();
}

/** Unit-size (0…1) shapes, built ONCE per kit with the immutable path API (Skia 2.6+). */
function buildPaths(skia: SkiaApi): Readonly<Partial<Record<string, SkPath>>> {
  const frame = skia.PathBuilder.Make().addRRect({ rect: { x: 0, y: 0, width: 1, height: 1 }, rx: 0.2, ry: 0.2 }).build();
  return { club: clubPath(skia), frame };
}

/** The rendering members of the game module (presentation.board of its ShellGameModule). */
export const demoGridBoard: GameBoard<DemoGridState, DemoGridView, BoardToken> = {
  isMirroredInRtl: false,
  toView,
  layout: layoutBoard,
  draw: drawBoard,
  buildPaths,
  describe: (view) => ({
    id: 'demo-grid.board.summary',
    values: {
      piecesCount: view.pieces.length,
      filledCount: view.cells.filter((cell) => cell !== 0).length,
    },
  }),
};
